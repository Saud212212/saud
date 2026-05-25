/* ════════════════════════════════════════════════════════════
   EngHub Pro — Commerce layer (Supabase auth + Stripe checkout)
   Loads only if config.js defines real keys. Otherwise dormant
   (the site keeps working in local-only mode).
   ════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const cfg = window.ENGHUB_CONFIG;
  function isConfigured(){
    return cfg && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT')
        && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR-');
  }
  if(!isConfigured()){
    console.info('[Commerce] Dormant — config.js not set. Running local-only mode.');
    return;
  }

  let sb = null, user = null, sub = null;

  /* ── Load Supabase JS from CDN, then init ── */
  function loadScript(src){
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function init(){
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    injectUI();
    sb.auth.onAuthStateChange((_e, session) => {
      user = session?.user || null;
      if(user) onLogin(); else onLogout();
    });
    const { data } = await sb.auth.getSession();
    user = data?.session?.user || null;
    if(user) onLogin(); else onLogout();
    wirePricingButtons();
    handleReturnFromCheckout();
  }

  /* ── Floating account button + auth modal ── */
  function injectUI(){
    const fab = document.createElement('button');
    fab.id = 'ehAcctFab';
    fab.style.cssText = 'position:fixed;top:120px;left:20px;z-index:9400;background:var(--panel,#0C1A2E);color:var(--ink,#EAF2FF);border:1px solid var(--accent,#FF6B35);padding:9px 14px;border-radius:999px;font-family:Cairo,sans-serif;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:6px;';
    fab.innerHTML = '👤 حسابي';
    fab.addEventListener('click', openModal);
    document.body.appendChild(fab);

    const modal = document.createElement('div');
    modal.id = 'ehAuthModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);z-index:9600;display:none;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
      <div style="background:var(--bg-2,#0E1B30);border:1px solid var(--line-strong,#2a3a52);border-radius:16px;padding:26px;max-width:400px;width:100%;font-family:Cairo,sans-serif;" id="ehAuthBox">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="font-weight:800;font-size:18px;color:var(--ink,#EAF2FF);" id="ehAuthTitle">تسجيل الدخول</div>
          <button id="ehAuthClose" style="background:none;border:none;color:#888;font-size:22px;cursor:pointer;">×</button>
        </div>
        <div id="ehAuthBody"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
    document.getElementById('ehAuthClose').addEventListener('click', closeModal);
  }

  function openModal(){ document.getElementById('ehAuthModal').style.display = 'flex'; renderModal(); }
  function closeModal(){ document.getElementById('ehAuthModal').style.display = 'none'; }

  const inputCss = 'width:100%;background:var(--input-bg,#06101F);border:1px solid var(--line,#1e2c44);border-radius:8px;padding:11px 13px;color:var(--ink,#EAF2FF);font-family:Cairo,sans-serif;font-size:14px;margin-bottom:10px;outline:none;';
  const btnCss = 'width:100%;padding:12px;border-radius:8px;background:var(--accent,#FF6B35);color:#fff;border:none;font-family:Cairo,sans-serif;font-weight:700;font-size:14px;cursor:pointer;';
  const linkCss = 'background:none;border:none;color:var(--accent,#FF6B35);cursor:pointer;font-family:Cairo,sans-serif;font-size:12.5px;margin-top:12px;';

  let mode = 'signin';
  function renderModal(){
    const body = document.getElementById('ehAuthBody');
    const title = document.getElementById('ehAuthTitle');
    if(user){
      title.textContent = 'حسابي';
      const tier = sub?.tier || 'free';
      const tierAr = {free:'مجاني', pro:'محترف', team:'فريق', enterprise:'مؤسسي'}[tier] || tier;
      const statusAr = sub?.status === 'active' ? 'نشط ✓' : (sub?.status || 'مجاني');
      body.innerHTML = `
        <div style="background:var(--bg-deep,#06101F);border:1px solid var(--line,#1e2c44);border-radius:10px;padding:14px;margin-bottom:14px;font-family:monospace;font-size:13px;color:var(--ink-2,#C5D4E8);">
          <div style="margin-bottom:6px;">📧 ${user.email}</div>
          <div>الباقة: <b style="color:var(--accent,#FF6B35);">${tierAr}</b> · ${statusAr}</div>
        </div>
        <button id="ehSync" style="${btnCss}background:transparent;color:var(--accent,#FF6B35);border:1px solid var(--accent,#FF6B35);margin-bottom:8px;">☁ مزامنة مشاريعي للسحابة</button>
        <button id="ehSignout" style="${btnCss}background:var(--danger,#FF3B30);">تسجيل الخروج</button>
      `;
      document.getElementById('ehSignout').onclick = async () => { await sb.auth.signOut(); closeModal(); };
      document.getElementById('ehSync').onclick = syncProjectsToCloud;
      return;
    }
    title.textContent = mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب';
    body.innerHTML = `
      ${mode==='signup' ? `<input id="ehName" placeholder="الاسم الكامل" style="${inputCss}" />` : ''}
      <input id="ehEmail" type="email" placeholder="البريد الإلكتروني" style="${inputCss}" />
      <input id="ehPass" type="password" placeholder="كلمة المرور (6+ أحرف)" style="${inputCss}" />
      <button id="ehSubmit" style="${btnCss}">${mode==='signin'?'دخول':'إنشاء حساب'}</button>
      <div id="ehMsg" style="font-family:Cairo;font-size:12px;color:var(--danger,#FF3B30);margin-top:10px;min-height:16px;"></div>
      <button id="ehToggle" style="${linkCss}">${mode==='signin'?'ليس لديك حساب؟ أنشئ واحداً':'لديك حساب؟ سجّل دخول'}</button>
    `;
    document.getElementById('ehToggle').onclick = () => { mode = mode==='signin'?'signup':'signin'; renderModal(); };
    document.getElementById('ehSubmit').onclick = submitAuth;
  }

  async function submitAuth(){
    const email = document.getElementById('ehEmail').value.trim();
    const pass = document.getElementById('ehPass').value;
    const msg = document.getElementById('ehMsg');
    msg.style.color = 'var(--danger,#FF3B30)';
    if(!email || pass.length < 6){ msg.textContent = 'أدخل بريداً وكلمة مرور 6 أحرف+'; return; }
    msg.textContent = '...';
    try {
      if(mode === 'signin'){
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if(error) throw error;
        closeModal();
      } else {
        const name = document.getElementById('ehName')?.value.trim() || '';
        const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
        if(error) throw error;
        msg.style.color = 'var(--success,#00C853)';
        msg.textContent = 'تم! تحقق من بريدك لتأكيد الحساب ثم سجّل دخول.';
      }
    } catch(e){ msg.textContent = e.message || 'خطأ في المصادقة'; }
  }

  /* ── Session state ── */
  async function onLogin(){
    const fab = document.getElementById('ehAcctFab');
    const { data } = await sb.from('subscriptions').select('*').eq('user_id', user.id).single();
    sub = data;
    if(fab){
      const tierAr = {free:'مجاني', pro:'محترف', team:'فريق', enterprise:'مؤسسي'}[sub?.tier||'free'];
      fab.innerHTML = `👤 ${user.email.split('@')[0]} · ${tierAr}`;
    }
    if(document.getElementById('ehAuthModal').style.display === 'flex') renderModal();
    await pullProjectsFromCloud();
  }
  function onLogout(){
    sub = null;
    const fab = document.getElementById('ehAcctFab');
    if(fab) fab.innerHTML = '👤 حسابي';
  }

  /* ── Cloud sync of projects (bridges Session-8 localStorage) ── */
  async function syncProjectsToCloud(){
    if(!user || !window.EngHubProjects){ alert('سجّل دخول أولاً'); return; }
    const state = window.EngHubProjects.state;
    for(const p of state.projects){
      const { data: proj } = await sb.from('projects').upsert({
        id: isUuid(p.id) ? p.id : undefined,
        user_id: user.id, name: p.name, code: p.code, location: p.location,
        updated_at: new Date().toISOString()
      }).select().single();
      if(proj){
        for(const c of p.calculations){
          await sb.from('calculations').upsert({
            id: isUuid(c.id) ? c.id : undefined,
            project_id: proj.id, user_id: user.id,
            calc_id: c.calcId, title: c.title,
            inputs: c.inputs || {}, results: c.results || [], ref: c.ref
          });
        }
      }
    }
    alert('تمت مزامنة مشاريعك للسحابة ✓');
  }
  async function pullProjectsFromCloud(){
    if(!user) return;
    const { data: projects } = await sb.from('projects').select('*, calculations(*)').order('updated_at', {ascending:false});
    if(projects && projects.length && window.EngHubProjects){
      // Merge cloud into local (cloud wins on id match) — best-effort
      console.info('[Commerce] Pulled', projects.length, 'cloud projects');
    }
  }
  function isUuid(s){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s)); }

  /* ── Stripe checkout via Edge Function ── */
  async function startCheckout(tier){
    if(!user){ openModal(); return; }
    const priceId = cfg.PRICES?.[tier];
    if(!priceId || priceId.includes('xxx')){ alert('لم يتم ضبط Price ID لهذه الباقة في config.js'); return; }
    try {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(`${cfg.FUNCTIONS_URL}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ priceId })
      });
      const json = await res.json();
      if(json.url) window.location.href = json.url;
      else throw new Error(json.error || 'فشل إنشاء جلسة الدفع');
    } catch(e){ alert('خطأ: ' + e.message); }
  }

  function wirePricingButtons(){
    // Map pricing cards (Session pricing section) to tiers by name text
    document.querySelectorAll('#pricing .price-card').forEach(card => {
      const name = (card.querySelector('.price-name')?.textContent || '').trim();
      const tier = name.includes('محترف') ? 'pro'
                 : name.includes('فريق') ? 'team'
                 : name.includes('مؤسسي') ? 'enterprise' : null;
      const btn = card.querySelector('a.btn, button.btn');
      if(tier && btn){
        btn.addEventListener('click', (e) => { e.preventDefault(); startCheckout(tier); });
      }
    });
  }

  function handleReturnFromCheckout(){
    if(location.hash.includes('paid=1')){
      setTimeout(() => alert('شكراً! تم تفعيل اشتراكك. قد يستغرق بضع ثوانٍ للظهور.'), 500);
      history.replaceState(null, '', location.pathname + location.search + '#projects-hub');
    }
  }

  window.EngHubCommerce = {
    get user(){ return user; }, get sub(){ return sub; },
    openModal, startCheckout, syncProjectsToCloud
  };

  init().catch(e => console.error('[Commerce] init failed:', e));
})();

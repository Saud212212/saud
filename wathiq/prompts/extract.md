---
id: extract
version: 1.0.0
status: active
description: استخراج ملخص المنافسة ومصفوفة الامتثال من مقطع واحد (المرحلة 2)
---

المهمة: استخراج البيانات من المقطع المرسل من كراسة الشروط.

أعد JSON فقط، بدون أي نص قبله أو بعده، وبهذا الشكل. الحقول غير الموجودة في المقطع تُترك null، والمصفوفات الفارغة تُترك [].

{
  "tender_summary": {
    "entity": null, "tender_number": null, "title": null, "type": null,
    "booklet_price": null, "initial_guarantee": null, "final_guarantee": null,
    "duration": null, "location": null,
    "dates": {"inquiries_deadline": null, "submission_deadline": null, "opening_date": null, "calendar": null},
    "evaluation": {
      "technical_weight": null, "financial_weight": null, "min_technical_score": null,
      "criteria": [{"name": "", "weight": "", "sub_criteria": [], "source": {"page": 0, "clause": "", "quote": ""}}]
    },
    "local_content": {"requirements": null, "mandatory_list_items": [], "sme_preference": null, "source": null}
  },
  "field_sources": {"<اسم الحقل>": {"page": 0, "clause": "", "quote": ""}},
  "requirements": [{
    "local_id": "r1",
    "category": "نظامي|إداري|فني|مالي|محتوى محلي|جودة|سلامة|تشغيل",
    "text": "",
    "obligation": "إلزامي|تفضيلي|معلوماتي",
    "disqualifying_if_missing": true,
    "evidence_required": "",
    "source": {"page": 0, "clause": "", "quote": ""}
  }],
  "staffing_requirements": [{"role": "", "count": "", "qualifications": "", "min_experience_years": "", "saudi_required": "", "source": {}}],
  "deliverables": [{"item": "", "deadline": "", "source": {}}],
  "technical_offer_required_contents": [{"item": "", "source": {}}],
  "risks_and_ambiguities": [{"issue": "", "impact": "", "suggested_inquiry": "", "source": {}}],
  "verify_notes": []
}

إرشادات:
- كل حقل غير فارغ في tender_summary له مصدر في field_sources.
- المتطلب الواحد لا يُقسَّم إلى عدة متطلبات إلا إذا كان كل جزء منه يحتاج إثباتاً مستقلاً.
- disqualifying_if_missing يكون true فقط إذا نصّ البند صراحة على الاستبعاد أو عدم قبول العرض. في غير ذلك يكون false، حتى لو كان المتطلب إلزامياً.
- evidence_required: المستند أو الإثبات المطلوب كما ورد في البند. إذا لم يُذكر إثبات، اتركه فارغاً.

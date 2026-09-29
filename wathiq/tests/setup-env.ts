import { applyTestEnv } from "./test-env";
import { setLlmProvider } from "@/server/ai/provider";
import { ScriptedProvider } from "./support/scripted-llm";

applyTestEnv();
// لا استدعاءات حقيقية للنموذج في الاختبارات: نموذج مُبرمَج بأخطاء معروفة
setLlmProvider(new ScriptedProvider());

import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", "public/pdf.worker.min.mjs", ".data/**", ".scratch/**"] }];
export default config;

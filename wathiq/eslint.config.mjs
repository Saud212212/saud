import next from "eslint-config-next";
export default [...next, { ignores: [".next/**", "public/pdf.worker.min.mjs", ".data/**"] }];

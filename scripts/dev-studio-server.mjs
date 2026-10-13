process.env.PORT = "8081";
process.env.HOST = "127.0.0.1";
const { createToolAtlasServer, developerToken } = await import("./server.mjs");
const server = createToolAtlasServer();
server.listen(8081, "127.0.0.1", () =>
  console.log(
    `Open the Vite Studio at http://127.0.0.1:5173/?page=developer#token=${developerToken}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));

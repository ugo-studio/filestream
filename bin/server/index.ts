import { Hono } from "hono";
import { getNetworkIpAddress, getRandomNumber } from "./lib/utils";
import { FileServer, type FileServerSocketMsg } from "./lib/file-server";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";

// initialize app, fileserver and websocket
const app = new Hono();
const fileServer = new FileServer();

// handler cors
app.use("/*", async ({ req, res }, next) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS")
    return new Response(null, { headers: res.headers });
  else return next();
});

// set routes
app.get("/", async (c) => {
  try {
    var proxy = c.req.query("p");
    if (proxy) {
      const resp = await fetch(proxy, c.req.raw);
      console.log(resp.body);
      return new Response(resp.body, resp);
    }

    return c.json({ ok: true });
  } catch (e: any) {
    return c.text(e.message, 500);
  }
});

app.get("/file", async (c) => {
  try {
    var id = c.req.query("id");
    var rid = c.req.query("rid");
    var name = c.req.query("name");
    var size = c.req.query("size");
    if (rid == null || id == null || name == null || size == null) {
      return c.text("queries not found", 403);
    }
    const req = await fileServer.requestFile(id, name, rid);
    fileServer.removeRequest(rid);
    return new Response(req);
  } catch (e: any) {
    return c.text(e.toString(), 404);
  }
});

app.post("/upload", async (c) => {
  try {
    let rid = c.req.query("rid");
    if (!rid) return c.text("rid not found", 403);
    // send request to receiver
    let index = fileServer.requests.findIndex((e) => e.rid === rid);
    if (index >= 0) await fileServer.requests[index].send(c.req.raw);
    // wait the the receiver to consume the request
    console.log(`sent file request: ${rid}`);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.text(e.toString(), 500);
  }
});

// gather server info
const info = {
  local: "127.0.0.1",
  network: getNetworkIpAddress(),
  port: 1064,
  // port: getRandomNumber(1025, 20000),
};

// start server
const server = serve(
  {
    port: info.port,
    hostname: "0.0.0.0",
    fetch: app.fetch,
  },
  () => console.log(JSON.stringify(info))
);

const wss = new WebSocketServer({ server: server as any });

wss.on("connection", (ws, req) => {
  const url = new URL(`http://localhost${req.url}`);
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name");
  if (!id || !name) return ws.close(403, `"id" or "name" not found!`);

  const close = (evt: any) => fileServer.remove(id, name, evt);

  ws.onclose = close;
  ws.onerror = close;
  ws.onopen = () => {
    ws.send(JSON.stringify({ ping: true } as FileServerSocketMsg));
    console.log(`connection request: ${id} --> ${name}`);
  };
  ws.onmessage = (evt) => {
    var msg: FileServerSocketMsg = JSON.parse(evt.data.toString());
    if (msg.ping == true) {
      fileServer.add({ id: id, name: name, socket: ws });
    } else {
      fileServer.broadcast({ ...msg, id, name });
    }
  };
});

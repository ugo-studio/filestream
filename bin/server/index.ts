import { Hono } from "hono";
import { lookup } from "mime-types";
import { getNetworkIpAddress, getRandomNumber } from "./lib/utils";
import { FileServer, type FileServerSocketMsg } from "./lib/file-server";
import { createBunWebSocket } from "hono/bun";

// initialize app, fileserver and websocket
const app = new Hono();
const fileServer = new FileServer();
const wss = createBunWebSocket();

// handler cors
app.use("/*", async ({ req, res }, next) => {
  res.headers.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS")
    return new Response(null, { headers: res.headers });
  else return next();
});

// set routes
app.get("/filestream/file", async (c) => {
  try {
    var id = c.req.query("id");
    var rid = c.req.query("rid");
    var name = c.req.query("name");
    var size = c.req.query("size");
    if (rid == null || id == null || name == null || size == null) {
      return c.text("queries not found", 403);
    }
    // request file stream
    const req = await fileServer.requestFile(id, name, rid);
    // get stats
    const type = lookup(name) || "application/octet-stream";
    return new Response(req, {
      headers: {
        "content-disposition": `attachment; filename="${name}";`,
        "content-length": size,
        "content-type": type,
      },
    });
  } catch (e: any) {
    return c.text(e.toString(), 404);
  }
});

app.post("/filestream/upload", async (c) => {
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

app.all("/filestream/connect", async (c, n) => {
  const id = c.req.query("id");
  const name = c.req.query("name");

  if (!id || !name) return c.text(`"id" or "name" not found!`, 403);

  return wss.upgradeWebSocket(() => {
    const close = (evt: any) => fileServer.remove(id, name, evt);
    return {
      onClose: close,
      onError: close,
      onMessage(evt, ws) {
        var msg: FileServerSocketMsg = JSON.parse(evt.data.toString());
        if (msg.ping == true) {
          fileServer.add({ id: id, name: name, socket: ws });
        } else {
          fileServer.broadcast({ ...msg, id, name });
        }
      },
      onOpen(_, ws) {
        ws.send(JSON.stringify({ ping: true } as FileServerSocketMsg));
        console.log(`connection request: ${id} --> ${name}`);
      },
    };
  })(c, n);
});

app.get("/*", async (c) => {
  try {
    const proxy = decodeURIComponent(Bun.argv[2]);
    if (proxy) {
      const url = new URL(
        c.req.url.replace(new URL(c.req.url).origin, new URL(proxy).origin)
      );
      const resp = await fetch(url, c.req.raw);
      return new Response(resp.body, resp);
    } else return c.json({ ok: true });
  } catch (e: any) {
    return c.text(e.message, 500);
  }
});

// gather server info
const info = {
  local: "127.0.0.1",
  network: getNetworkIpAddress(),
  port: getRandomNumber(1025, 20000),
};

// start server
Bun.serve({
  port: info.port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
  websocket: wss.websocket,
  maxRequestBodySize: 1024 * 1024 * 10000,
});
console.log(JSON.stringify(info));

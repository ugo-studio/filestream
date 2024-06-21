import type { WSContext } from "hono/ws";

export interface FileServerSocketMsg {
  ping?: true;
  text?: string;
  file?: string;
  fileSize?: number;
  fileRID?: string;
  joined?: Record<string, any>;
  name?: string;
  mid?: string;
  id?: string;
}

export interface FileServerConnection {
  id: string;
  name: string;
  socket: WSContext;
}

export interface FileServerRequest {
  rid: string;
  send: (req: Request) => any;
}

export class FileServer {
  private _connections: FileServerConnection[] = [];
  private _requests: FileServerRequest[] = [];

  get connections() {
    return this._connections;
  }
  get requests() {
    return this._requests;
  }

  add(c: FileServerConnection) {
    if (this._connections.findIndex((e) => e.id === c.id) === -1) {
      this._connections.push(c);
      this.broadcast({
        joined: {
          id: c.id,
          name: c.name,
          stat: true,
        },
      });
      console.log(`connected: ${c.id} --> ${c.name}`);
    }
  }

  remove(id: string, name: string, err?: any) {
    let index = this._connections.findIndex((e) => e.id === id);
    if (index >= 0) {
      this._connections.splice(index, 1);
      this.broadcast({
        joined: {
          id: id,
          name: name,
          stat: false,
        },
      });
      if (err == null) {
        console.log(`closed connection: ${id} --> ${name}`);
      } else {
        console.log(`failed connection: ${id} --> ${name}, ${err.message}`);
      }
    }
  }

  broadcast(msg: FileServerSocketMsg) {
    for (var c of this._connections) {
      c.socket.send(JSON.stringify(msg));
    }
  }

  requestFile(id: string, name: string, rid: string) {
    return new Promise<string | any>((resolve, reject) => {
      let sending = false;
      const send = async (req?: Request) => {
        if (req) {
          sending = true;
          // send stream to the receiver
          const { readable, writable } = new TransformStream();
          await new Promise<void>(async (r) => {
            try {
              const file: File | null = (await req.formData()).get(
                "file"
              ) as any;
              file?.stream()?.pipeTo(writable);
              resolve(readable);
              console.log(`piping file to response: ${name}`);
              // wait for receiver to consume the stream
              const timeout = setTimeout(() => {
                clearInterval(timer);
                r();
              }, 60000 * 10); /* 10 minutes */
              const timer = setInterval(() => {
                if (!writable.locked) {
                  clearTimeout(timeout);
                  clearInterval(timer);
                  r();
                }
              }, 2000);
            } catch (err) {
              r();
              writable.close();
              console.error(`error sending stream: ${err}`);
            }
          });
          // remove request on finish
          this.removeRequest(rid);
          sending = false;
        } else {
          if (!sending) {
            this.removeRequest(rid);
            reject(new Error("file not found"));
          }
        }
      };
      this._requests.push({ rid, send });
      // send error if file not sent
      setTimeout(() => send(), 5000);
      // notify sender that a connection wants the file
      this.broadcast({ id: id, fileRID: rid, file: name });
    });
  }

  removeRequest(rid: string) {
    let index = this._requests.findIndex((e) => e.rid === rid);
    if (index >= 0) this._requests.splice(index, 1);
  }
}

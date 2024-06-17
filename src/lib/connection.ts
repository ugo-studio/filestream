import { v4 } from "uuid";

const STORAGE_KEY_PREFIX = "_filestream_storage_";

export class FileServer {
  socket: WebSocket | null = null;
  serverAddr: string | null = null;
  shareAddr: string | null = null;
  name: string | null = null;
  timeout: any = null;
  timer: any = null;
  id: string;

  private _files: File[] = [];
  private _messages: FileServerMsg[] = [];
  private _stat: FileServerStat = FileServerStat.closed;
  onMessageUpdate: (msg: FileServer["_messages"]) => any;
  onStatusChange: (stat: FileServerStat) => any;

  constructor() {
    let url = new URL(window.location.href);
    let params = url.searchParams;

    try {
      this.serverAddr = params.get("s");
      this.shareAddr = `http://${new URL(`${this.serverAddr}`).hostname}:${
        url.port
      }/?s=${encodeURIComponent(this.serverAddr ?? "")}`;
    } catch (_) {}

    this.id = v4();
    this.onStatusChange = () => null;
    this.onMessageUpdate = () => null;
  }

  get stat() {
    return this._stat;
  }
  get messages() {
    return this._messages;
  }
  get files() {
    return this._files;
  }
  private changeStatus(s: FileServerStat) {
    this._stat = s;
    this.onStatusChange(s);
  }
  private dropMessage(msg: FileServerMsg, replace?: boolean) {
    if (replace) {
      let index = this._messages.findIndex((m) => m.data.mid === msg.data.mid);
      this._messages[index] = msg;
    } else this._messages.push(msg);
    this.onMessageUpdate(this.messages);
  }

  getName() {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}username`);
  }
  setName(name: string) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}username`, name);
  }

  disconnect(e?: any) {
    // console.log("closed");
    this.socket?.close();
    this.socket = null;
    clearInterval(this.timer);
    clearTimeout(this.timeout);
    this.changeStatus(FileServerStat.closed);
    if (e && e.message) console.log(e.message);
  }

  async connect() {
    try {
      if (!this.serverAddr) {
        throw new Error("server not found");
      }

      this.disconnect();
      this.changeStatus(FileServerStat.connecting);

      this.name = this.getName() ?? navigator.platform;

      const url = new URL(this.serverAddr);
      url.pathname = "/connect";
      url.protocol = "ws";
      url.searchParams.set("id", this.id);
      url.searchParams.set("name", this.name);

      this.socket = new WebSocket(url.toString());
      this.timeout = setTimeout(() => this.disconnect(), 4000);
      this.socket.onerror = (e) => this.disconnect(e);
      this.socket.onclose = (e) => this.disconnect(e);
      this.socket.onopen = () => {
        clearTimeout(this.timeout);
        this.changeStatus(FileServerStat.connected);
        this.timer = setInterval(() => {
          this.send({ ping: true });
        }, 5000);
        // console.log("opened");
      };
      this.socket.onmessage = (e) => {
        console.log(e.data);
        const data: FileServerSocketMsg = JSON.parse(e.data);
        if (data.ping) {
          this.send({ ping: true });
        } else if (data.fileRID) {
          this.uploadFile(data);
        } else {
          this.receive(data);
        }
      };
    } catch (err: any) {
      this.disconnect(err);
    }
  }

  private async uploadFile(data: FileServerSocketMsg) {
    if (data.id == this.id) {
      const url = new URL(this.serverAddr!);
      url.pathname = "/upload";
      url.searchParams.set("rid", data.fileRID!);

      const file = this._files.find((e) => e.name === data.file);
      if (file) {
        // const body = new FormData();
        // body.set("file", file);

        await fetch(url, {
          method: "POST",
          body: file.stream(),
          duplex: "half",
        } as any).catch((e) => console.log(e.message));
      }
    }
  }

  private async receive(msg: FileServerSocketMsg) {
    if (msg.id === this.id) {
      this.dropMessage(
        {
          stat: {
            sent: true,
            read: true,
          },
          data: msg,
        },
        true
      );
    } else {
      this.dropMessage({
        stat: {
          sent: false,
          read: false,
        },
        data: msg,
      });
    }
  }

  async send(msg: FileServerSocketMsg, replace?: boolean) {
    if (!msg.ping) {
      msg.mid = v4();
      this.dropMessage(
        {
          stat: {
            sent: true,
            read: false,
          },
          data: msg,
        },
        replace
      );
    }
    this.socket?.send(JSON.stringify(msg));
  }

  addFile(f: File) {
    let index = this._files.findIndex((e) => e.name === f.name);
    if (index >= 0) {
      this._files.splice(index, 1);
    }
    this._files.push(f);
  }

  getFileDownloadUrl(senderId: string, filename: string, filesize: number) {
    if (!this.serverAddr) {
      throw new Error("server not found");
    }
    const url = new URL(this.serverAddr);
    url.pathname = "/file";
    url.searchParams.set("id", senderId);
    url.searchParams.set("rid", v4());
    url.searchParams.set("name", filename);
    url.searchParams.set("size", String(filesize));
    return url.toString();
  }
}

export enum FileServerStat {
  closed,
  connecting,
  connected,
}

export interface FileServerSocketMsg {
  fileRID?: string;
  fileSize?: number;
  joined?: {
    id: string;
    name: string;
    stat: boolean;
  };
  file?: string;
  text?: string;
  ping?: boolean;
  name?: string;
  mid?: string;
  id?: string;
}

export interface FileServerMsg {
  stat: { sent: boolean; read: boolean };
  data: FileServerSocketMsg;
}

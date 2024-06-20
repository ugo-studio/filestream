<script lang="ts">
  import "@fontsource/fira-mono";
  import "@fontsource/poppins";

  import { Icon } from "svelte-icons-pack";
  import { IoQrCode } from "svelte-icons-pack/io";
  import { FileServer, FileServerStat } from "../lib/connection";
  import Messages from "../comp/messages.svelte";
  import { onDestroy, onMount } from "svelte";
  import QrcodeView from "../comp/qrcode-view.svelte";
  import Username from "../comp/username.svelte";
  import { Child, Command } from "@tauri-apps/api/shell";
  import { resourceDir } from "@tauri-apps/api/path";

  let server = new FileServer();
  let command: Command | undefined;
  let process: Child | undefined;
  let showQr = false;

  onMount(async () => {
    if (server.stat === FileServerStat.closed) {
      if (!server.serverAddr) {
        await process?.kill();
        const info = await startProcess();
        if (info && info.network && info.port) {
          let serverAddr = `http://${info.network}:${info.port}`;
          let shareAddr = `${serverAddr}/?s=${encodeURIComponent(serverAddr)}`;
          server.serverAddr = serverAddr;
          server.shareAddr = shareAddr;
          console.log(info, serverAddr, shareAddr);
        }
      }
      server.connect();
    }
  });

  onDestroy(() => {
    process?.kill();
    command = undefined;
    server.disconnect();
  });

  const startProcess = () =>
    new Promise<any>(async (resolve) => {
      command = Command.sidecar(
        "bin/server",
        encodeURIComponent(await resourceDir())
      );
      command.on("error", (_) => resolve(process?.kill()));
      command.on("close", (_) => resolve(process?.kill()));
      command.stdout.on("data", (d) => {
        try {
          let json = JSON.parse(String(d));
          resolve(json);
        } catch (_) {}
      });
      process = await command.spawn();
    });
</script>

<svelte:head>
  <title>FileStream</title>
  <meta name="description" content="easy file sharing" />
</svelte:head>

<div class="app">
  <button
    class="qrBtn {showQr ? 'showing' : ''}"
    on:click={() => (showQr = !showQr)}
  >
    <Icon src={IoQrCode} size={15} color="white" />
  </button>

  <!-- body  -->
  <div class="body">
    <Messages {server} />
    {#if showQr}
      <QrcodeView shareAddr={server.shareAddr} />
    {/if}
    <Username {server} />
  </div>
</div>

<style lang="scss">
  :root {
    --bg-color: #202020;
  }

  .app {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    background-color: var(--bg-color);
    overflow: hidden;
    user-select: none;

    .qrBtn {
      height: 50px;
      width: 95%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: transparent;
      border: 1px solid #006391;
      margin: 5px 2.5%;
    }
    .qrBtn.showing {
      background: #006391;
    }

    .body {
      height: calc(100% - 55px);
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
  }
</style>

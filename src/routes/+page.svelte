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

  let server = new FileServer(() => null);
  let command: Command | undefined;
  let process: any | undefined;
  let timer: any;
  let showQr = false;

  const startProcess = () =>
    new Promise<any>(async (resolve, reject) => {
      command = Command.sidecar("binaries/server");
      command.stdout.on("data", (d) => {
        console.log(d);
      });
      command.stderr.on("data", (d) => {
        console.log(d);
      });
      process = await command.execute();
      console.log(process)
    });

  onMount(async () => {
    if (!server.serverAddr) {
      startProcess();
    }
    server.connect();
    timer = setInterval(() => {
      if (server.stat == FileServerStat.closed) {
        server.connect();
      }
    }, 1000);
  });

  onDestroy(() => {
    process?.kill();
    command = undefined;
    clearInterval(timer);
    server.disconnect();
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

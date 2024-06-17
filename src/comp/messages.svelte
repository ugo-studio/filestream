<script lang="ts">
  import {
    FileServer,
    FileServerStat,
    type FileServerMsg,
  } from "$lib/connection";
  import { onMount } from "svelte";
  import { Icon } from "svelte-icons-pack";
  import { BiSolidImageAdd } from "svelte-icons-pack/bi";
  import { TrOutlineSend } from "svelte-icons-pack/tr";
  import { BsArrowDownShort } from "svelte-icons-pack/bs";
  import { BsCheckCircleFill } from "svelte-icons-pack/bs";
  import { BiSolidErrorCircle } from "svelte-icons-pack/bi";

  export let server: FileServer;

  let messages = server.messages;
  let stat = server.stat;
  let unseen = 0;

  onMount(() => {
    server.onStatusChange = (s) => (stat = s);
    server.onMessageUpdate = (m) => {
      let newMsgs = m.slice(messages.length - 1);
      messages = m;
      // wait for re-render to scroll to bottom
      let containsSent = newMsgs.findIndex((e) => e.stat.sent == true) !== -1;
      if (viewingNewMsg() || containsSent) {
        let timer = setInterval(() => {
          if (msgPanel.children.length == m.length) {
            clearInterval(timer);
            msgPanel.scrollTo({
              top: msgPanel.scrollHeight,
              behavior: "smooth",
            });
          }
        });
        setTimeout(() => clearInterval(timer), 1000);
      } else {
        unseen++;
      }
    };
    msgPanel.onscroll = () => {
      if (viewingNewMsg()) unseen = 0;
    };
  });

  let text: string = "";
  let fileInput: HTMLInputElement;
  let textInput: HTMLInputElement;
  let msgPanel: HTMLDivElement;

  const viewingNewMsg = () => {
    return msgPanel.scrollHeight - msgPanel.scrollTop < 700;
  };

  const add = async () => {
    const files = fileInput.files;
    if (!files || files?.length == 0) return;
    for (const file of files) {
      server.addFile(file);
      await server.send({ file: file.name, fileSize: file.size });
    }
    fileInput.value = "";
  };

  const send = async () => {
    if (text.length == 0) return;
    textInput.value = "";
    await server.send({ text });
  };

  const handleClick = async ({ data, stat }: FileServerMsg) => {
    // download file
    if (data.file && data.fileSize && data.id && !stat.sent) {
      const url = server.getFileDownloadUrl(data.id, data.file, data.fileSize);
      window.open(url, "_blank");
      return;
    }
    // retry failed messages
    if (stat.sent && !stat.read) {
      await server.send(data, true);
      return;
    }
  };

  function formatFileSize(bytes: number, decimalPlaces = 2) {
    if (bytes === 0) return "0 B";
    const k = 1024; // Define the kilo value
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k)); // Determine the size index
    // Calculate the size in the appropriate unit and format it
    const fileSize = parseFloat(
      (bytes / Math.pow(k, i)).toFixed(decimalPlaces)
    );
    return `${fileSize} ${sizes[i]}`;
  }
</script>

<div class="msg-con">
  <!-- connection status  -->
  <p class="status">
    {stat === FileServerStat.connecting
      ? "connecting..."
      : stat === FileServerStat.connected
        ? "connected"
        : "not connected,"}
    {#if stat === FileServerStat.closed}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <span on:click={() => server.connect()}>reconnect</span>
    {/if}
  </p>

  <!-- messages  -->
  <div class="msg" bind:this={msgPanel}>
    {#each messages as { data, stat }, i}
      <div class={stat.sent ? "sent" : data.joined ? "join" : "rec"}>
        {#if data.name && stat.sent == false && messages[i - 1]?.data.id != data.id}
          <div class="name">{data.name}</div>
        {/if}
        <button
          on:click={() => handleClick({ data, stat })}
          class="inner {data.file ? 'file' : data.joined ? 'join' : ''}"
        >
          {#if data.file}
            <div class="icon">
              <span class="size">{formatFileSize(data.fileSize ?? 0)}</span>
            </div>
          {/if}
          {data.text ??
            data.file ??
            `${data.joined?.id === server.id ? "you have" : `"${data.joined?.name}" has`} ${data.joined?.stat ? "joined" : "left"}`}

          {#if stat.sent}
            <div class="stat {stat.read}">
              {#if stat.read}
                <Icon src={BsCheckCircleFill} size={12} />
              {:else}
                <Icon src={BiSolidErrorCircle} size={15} />
              {/if}
            </div>
          {/if}
        </button>
      </div>
    {/each}
  </div>

  <!-- unseen  -->
  {#if unseen > 0}
    <button
      class="unseen"
      on:click={() => {
        msgPanel.scrollTo({
          top: msgPanel.scrollHeight,
          behavior: "smooth",
        });
      }}
    >
      <p class="num">{unseen}</p>
      <Icon src={BsArrowDownShort} size={30} color="white" />
    </button>
  {/if}

  <!-- panel  -->
  <div class="panel">
    <button type="button" class="add" on:click={() => fileInput.click()}>
      <Icon src={BiSolidImageAdd} size={25} color="white" />
      <input
        bind:this={fileInput}
        type="file"
        style="display:none;"
        multiple
        on:change={add}
      />
    </button>
    <input
      bind:this={textInput}
      on:input={(e) => (text = e.currentTarget.value)}
      on:keyup={(e) => e.key?.toLowerCase() == "enter" && send()}
      type="text"
      class="text"
      placeholder="write something..."
      value={text}
      max="1"
    />
    <button type="button" class="send {text.length > 0}" on:click={send}>
      <Icon src={TrOutlineSend} size={25} color="white" />
    </button>
  </div>
</div>

<style lang="scss">
  .msg-con {
    height: 100%;
    width: 100%;

    .status {
      color: #fff;
      font-size: 0.8em;
      font-family: "Poppins";
      width: 100%;
      text-align: center;
      span {
        color: #71aaff;
        text-decoration: underline;
      }
    }

    .msg {
      height: calc(100% - 100px);
      width: 100%;
      padding: 10px 5px;
      overflow-x: hidden;
      overflow-y: scroll;
      .join {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        .inner {
          font-size: 0.6em;
          font-weight: 400;
          font-family: "Poppins";
          background: #3d3d3d;
          color: #fff;
          border: 1px solid grey;
          border-radius: 5px;
          padding: 5px;
          align-items: center;
          margin: 3px;
        }
      }
      .sent {
        align-items: end;
        .inner {
          border-radius: 12px 12px 0px 12px;
          background: #006391;
        }
      }
      .rec {
        align-items: start;
        .inner {
          border-radius: 0px 12px 12px 12px;
          background: var(--bg-color);
        }
      }
      .sent,
      .rec {
        height: fit-content;
        width: 100%;
        margin: 5px 0px;
        padding: 0px 5px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        .name {
          color: #fff;
          font-size: 0.7em;
          height: 20px;
          width: 100px;
          margin-top: 10px;
          margin-bottom: 5px;
          font-family: "Fira Mono";
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .inner.file {
          word-break: break-all;
          font-size: 0.7em;
        }
        .inner {
          position: relative;
          padding: 10px;
          border: 1px solid #006391;
          text-decoration: none;
          font-family: "Poppins";
          word-wrap: break-word;
          color: #fff;
          font-size: 0.78em;
          max-width: 80%;
          user-select: all;
          .icon {
            height: 30px;
            width: 100%;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            .size {
              font-size: 0.85em;
              font-weight: 400;
              font-family: "Poppins";
              background: #3d3d3d;
              border: 1px solid grey;
              border-radius: 5px;
              padding: 5px;
            }
          }
          .stat.true {
            color: #27ff27;
            animation: fade 5s forwards linear;
          }
          @keyframes fade {
            0% {
              opacity: 1;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
          .stat.false {
            color: #ff0000;
          }
          .stat {
            position: absolute;
            top: -5px;
            left: -5px;
          }
        }
      }
    }

    .unseen {
      position: absolute;
      bottom: 100px;
      right: 20px;
      background: var(--bg-color);
      border: 1px solid #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 100%;
      .num {
        position: absolute;
        top: -5px;
        right: -5px;
        color: #fff;
        background: green;
        font-family: "Poppins";
        border-radius: 100%;
        font-size: 12px;
        height: 15px;
        width: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }

    .panel {
      height: 60px;
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-evenly;
      .add,
      .send {
        border: none;
        background: none;
      }
      .send.false {
        opacity: 0.3;
      }
      .text {
        height: 80%;
        width: 60%;
        border: none;
        border-radius: 10px;
        padding: 5px 10px;
        background: #353535;
        color: #fff;
      }
      .text::placeholder {
        color: #949494;
      }
    }
  }
</style>

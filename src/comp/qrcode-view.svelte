<script lang="ts">
  export let shareAddr: string | null;

  import { toCanvas } from "qrcode";
  import { onDestroy, onMount } from "svelte";

  let timer: any;
  let canvas: HTMLCanvasElement;
  let err: string | undefined | null;

  onMount(() => {
    drawQrCode();
    timer = setInterval(drawQrCode, 1000);
  });

  onDestroy(() => {
    clearInterval(timer);
  });

  const drawQrCode = () => {
    let qrValue = shareAddr ?? "";
    toCanvas(canvas, qrValue, (e) => {
      err = e?.message;
    });
  };
</script>

<div class="qrcode">
  <canvas bind:this={canvas} width="250px" height="250px" />
</div>

<style lang="scss">
  .qrcode {
    position: absolute;
    height: 100%;
    width: 100%;
    background: red;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-color);
  }
  canvas {
    height: 250px;
    width: 250px;
    background: white;
    border-radius: 20px;
  }
</style>

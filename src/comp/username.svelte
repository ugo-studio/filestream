<script lang="ts">
  import { FileServerStat, type FileServer } from "$lib/connection";
  import { onMount } from "svelte";

  export let server: FileServer;

  let display: boolean = true;
  let prevname: string = "";
  let name: string = "";

  onMount(() => {
    name = prevname = server.getName() ?? "";
  });

  let busy = false;
  const use = async () => {
    if (busy) return;
    busy = true;
    name = name.trim();
    if (name.length < 3) {
      alert("name can't be less than 3 characters");
    } else {
      server.setName(name);
      if (prevname != name) await server.connect();
      else if (server.stat !== FileServerStat.connected) await server.connect();
      display = false;
    }
    busy = false;
  };
</script>

{#if display}
  <div class="username">
    <label for="name" class="label">user name</label>
    <input
      type="text"
      name="name"
      class="name"
      placeholder="write user name..."
      value={name}
      on:input={(e) => (name = e.currentTarget.value)}
      on:keyup={(e) => {
        if (e.key?.toLowerCase() === "enter") use();
      }}
    />
    <button
      type="button"
      class="use"
      on:click={use}
      style="opacity: {busy ? 0.5 : 1};">use</button
    >
  </div>
{/if}

<style lang="scss">
  .username {
    position: absolute;
    height: 100%;
    width: 100%;
    background: red;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg-color);
  }
  .label {
    color: #fff;
    font-family: "Poppins";
    font-size: 1.2em;
    font-weight: 600;
    margin: 10px 0px;
  }
  .name {
    height: 80px;
    width: 80%;
    border: none;
    border-radius: 10px;
    padding: 5px 10px;
    background: #353535;
    color: #fff;
    font-family: "Poppins";
  }
  .name::placeholder {
    color: #949494;
  }
  .use {
    height: 80px;
    width: 60%;
    border-radius: 20px;
    font-family: "Poppins";
    font-size: 16px;
    border: none;
    background: black;
    color: white;
    margin: 50px 0px;
  }
</style>

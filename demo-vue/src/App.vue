<script setup>
import { onMounted, ref } from "vue";
import { loadJS9Runtime } from "../../src/lib/index.js";

const status = ref("Loading JS9 runtime...");

onMounted(async () => {
  try {
    await loadJS9Runtime({ baseUrl: "" });
    status.value = "JS9 runtime loaded";
  } catch (err) {
    status.value = `Failed to load JS9 runtime: ${err.message}`;
  }
});
</script>

<template>
  <main>
    <h1>JS9 Vue Demo</h1>
    <p>{{ status }}</p>
    <div id="js9-host">
      <div class="JS9"></div>
    </div>
  </main>
</template>

<style scoped>
main {
  display: grid;
  gap: 0.75rem;
}

h1 {
  margin: 0;
  font-size: 1.35rem;
}

#js9-host {
  margin-top: 0.5rem;
}
</style>

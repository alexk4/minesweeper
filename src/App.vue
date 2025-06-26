<template>
  <div class="minesweeper-app">
    <h1>Minesweeper</h1>
    <GameBoard />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import GameBoard from './components/GameBoard.vue';

export default defineComponent({
  name: 'App',
  components: {
    GameBoard
  }
});
</script>

<style>
.minesweeper-app {
  font-family: 'Arial', sans-serif;
  text-align: center;
  margin: 0 auto;
  padding: 20px;
  max-width: 600px;
}

h1 {
  color: #333;
  margin-bottom: 20px;
}
</style>

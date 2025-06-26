<template>
  <div class="game-container">
    <div class="game-header">
      <div class="mine-counter">🚩 {{ flagsLeft }}</div>
      <button class="reset-button" @click="resetGame">
        {{ gameStatus === 'lost' ? '😵' : gameStatus === 'won' ? '😎' : '🙂' }}
      </button>
      <div class="timer">⏱️ {{ timer }}</div>
    </div>
    
    <div class="difficulty-selector">
      <button 
        v-for="level in difficultyLevels" 
        :key="level.name"
        @click="setDifficulty(level)"
        :class="{ active: currentDifficulty.name === level.name }"
      >
        {{ level.name }}
      </button>
    </div>
    
    <div class="game-board" :style="boardStyle">
      <div 
        v-for="(row, rowIndex) in board" 
        :key="rowIndex" 
        class="board-row"
      >
        <div 
          v-for="(cell, colIndex) in row" 
          :key="`${rowIndex}-${colIndex}`" 
          class="cell"
          :class="{
            'revealed': cell.isRevealed,
            'flagged': cell.isFlagged,
            'mine': cell.isMine && cell.isRevealed,
            [`adjacent-${cell.adjacentMines}`]: cell.isRevealed && cell.adjacentMines > 0
          }"
          @click="revealCell(rowIndex, colIndex)"
          @contextmenu.prevent="toggleFlag(rowIndex, colIndex)"
        >
          <template v-if="cell.isRevealed">
            <template v-if="cell.isMine">💣</template>
            <template v-else-if="cell.adjacentMines > 0">{{ cell.adjacentMines }}</template>
          </template>
          <template v-else-if="cell.isFlagged">🚩</template>
        </div>
      </div>
    </div>
    
    <div v-if="gameStatus !== 'playing'" class="game-message">
      {{ gameStatus === 'won' ? 'You Win! 🎉' : 'Game Over! 💥' }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

interface DifficultyLevel {
  name: string;
  rows: number;
  cols: number;
  mines: number;
}

export default defineComponent({
  name: 'GameBoard',
  setup() {
    // Difficulty levels
    const difficultyLevels: DifficultyLevel[] = [
      { name: 'Easy', rows: 9, cols: 9, mines: 10 },
      { name: 'Medium', rows: 16, cols: 16, mines: 40 },
      { name: 'Hard', rows: 16, cols: 30, mines: 99 }
    ];
    
    const currentDifficulty = ref<DifficultyLevel>(difficultyLevels[0]);
    const board = ref<Cell[][]>([]);
    const gameStatus = ref<'playing' | 'won' | 'lost'>('playing');
    const minesCount = ref(0);
    const flagsCount = ref(0);
    const timer = ref(0);
    let timerInterval: number | null = null;
    
    const flagsLeft = computed(() => minesCount.value - flagsCount.value);
    
    const boardStyle = computed(() => ({
      gridTemplateColumns: `repeat(${currentDifficulty.value.cols}, var(--cell-size))`,
      gridTemplateRows: `repeat(${currentDifficulty.value.rows}, var(--cell-size))`
    }));
    
    // Initialize the game board
    const initializeBoard = () => {
      const { rows, cols } = currentDifficulty.value;
      const newBoard: Cell[][] = [];
      
      // Create empty board
      for (let i = 0; i < rows; i++) {
        const row: Cell[] = [];
        for (let j = 0; j < cols; j++) {
          row.push({
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0
          });
        }
        newBoard.push(row);
      }
      
      board.value = newBoard;
    };
    
    // Place mines randomly on the board
    const placeMines = (firstClickRow: number, firstClickCol: number) => {
      const { rows, cols, mines } = currentDifficulty.value;
      minesCount.value = mines;
      
      let minesPlaced = 0;
      while (minesPlaced < mines) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        
        // Don't place a mine on the first clicked cell or where a mine already exists
        if ((randomRow !== firstClickRow || randomCol !== firstClickCol) && 
            !board.value[randomRow][randomCol].isMine) {
          board.value[randomRow][randomCol].isMine = true;
          minesPlaced++;
        }
      }
      
      // Calculate adjacent mines for each cell
      calculateAdjacentMines();
    };
    
    // Calculate the number of adjacent mines for each cell
    const calculateAdjacentMines = () => {
      const { rows, cols } = currentDifficulty.value;
      
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (!board.value[i][j].isMine) {
            let count = 0;
            
            // Check all 8 adjacent cells
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                
                const ni = i + di;
                const nj = j + dj;
                
                if (ni >= 0 && ni < rows && nj >= 0 && nj < cols && 
                    board.value[ni][nj].isMine) {
                  count++;
                }
              }
            }
            
            board.value[i][j].adjacentMines = count;
          }
        }
      }
    };
    
    // Reveal a cell when clicked
    const revealCell = (row: number, col: number) => {
      if (gameStatus.value !== 'playing') return;
      
      const cell = board.value[row][col];
      
      // Can't reveal flagged cells or already revealed cells
      if (cell.isFlagged || cell.isRevealed) return;
      
      // First click - start the game
      if (board.value.flat().every(cell => !cell.isRevealed)) {
        startTimer();
        placeMines(row, col);
      }
      
      // Reveal the cell
      cell.isRevealed = true;
      
      // If it's a mine, game over
      if (cell.isMine) {
        gameOver();
        return;
      }
      
      // If it's an empty cell (no adjacent mines), reveal adjacent cells
      if (cell.adjacentMines === 0) {
        revealAdjacentCells(row, col);
      }
      
      // Check if the player has won
      checkWinCondition();
    };
    
    // Reveal adjacent cells recursively for empty cells
    const revealAdjacentCells = (row: number, col: number) => {
      const { rows, cols } = currentDifficulty.value;
      
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          
          const ni = row + di;
          const nj = col + dj;
          
          if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
            const adjacentCell = board.value[ni][nj];
            
            if (!adjacentCell.isRevealed && !adjacentCell.isFlagged) {
              adjacentCell.isRevealed = true;
              
              if (adjacentCell.adjacentMines === 0) {
                revealAdjacentCells(ni, nj);
              }
            }
          }
        }
      }
    };
    
    // Toggle flag on right-click
    const toggleFlag = (row: number, col: number) => {
      if (gameStatus.value !== 'playing') return;
      
      const cell = board.value[row][col];
      
      // Can't flag revealed cells
      if (cell.isRevealed) return;
      
      // Toggle flag
      cell.isFlagged = !cell.isFlagged;
      
      // Update flag count
      flagsCount.value += cell.isFlagged ? 1 : -1;
      
      // Check if the player has won
      checkWinCondition();
    };
    
    // Check if the player has won
    const checkWinCondition = () => {
      const allNonMinesCellsRevealed = board.value.flat().every(cell => 
        cell.isMine || cell.isRevealed
      );
      
      if (allNonMinesCellsRevealed) {
        gameStatus.value = 'won';
        stopTimer();
      }
    };
    
    // Game over when a mine is clicked
    const gameOver = () => {
      gameStatus.value = 'lost';
      stopTimer();
      
      // Reveal all mines
      board.value.forEach(row => {
        row.forEach(cell => {
          if (cell.isMine) {
            cell.isRevealed = true;
          }
        });
      });
    };
    
    // Reset the game
    const resetGame = () => {
      gameStatus.value = 'playing';
      flagsCount.value = 0;
      timer.value = 0;
      stopTimer();
      initializeBoard();
    };
    
    // Set difficulty level
    const setDifficulty = (level: DifficultyLevel) => {
      currentDifficulty.value = level;
      resetGame();
    };
    
    // Timer functions
    const startTimer = () => {
      if (timerInterval) return;
      
      timerInterval = window.setInterval(() => {
        timer.value++;
      }, 1000);
    };
    
    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };
    
    // Lifecycle hooks
    onMounted(() => {
      initializeBoard();
    });
    
    onUnmounted(() => {
      stopTimer();
    });
    
    return {
      board,
      gameStatus,
      timer,
      flagsLeft,
      difficultyLevels,
      currentDifficulty,
      boardStyle,
      revealCell,
      toggleFlag,
      resetGame,
      setDifficulty
    };
  }
});
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #c0c0c0;
  border: 3px solid #7b7b7b;
  border-radius: 5px;
  padding: 15px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.game-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 15px;
  background-color: #c0c0c0;
  padding: 10px;
  border: 2px solid #7b7b7b;
}

.mine-counter, .timer {
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 1.2rem;
  background-color: #000;
  color: #f00;
  padding: 5px 10px;
  border-radius: 3px;
  min-width: 80px;
  text-align: center;
}

.reset-button {
  font-size: 1.5rem;
  background-color: #c0c0c0;
  border: 2px outset #f0f0f0;
  border-radius: 5px;
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.reset-button:active {
  border-style: inset;
}

.difficulty-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.difficulty-selector button {
  padding: 5px 10px;
  background-color: #c0c0c0;
  border: 2px outset #f0f0f0;
  border-radius: 3px;
  font-weight: bold;
}

.difficulty-selector button.active {
  background-color: #a0a0a0;
  border-style: inset;
}

.game-board {
  display: grid;
  gap: 1px;
  background-color: #7b7b7b;
  border: 3px solid #7b7b7b;
}

.board-row {
  display: contents;
}

.cell {
  width: var(--cell-size);
  height: var(--cell-size);
  background-color: #c0c0c0;
  border: 2px outset #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 1.2rem;
  user-select: none;
}

.cell:hover:not(.revealed) {
  background-color: var(--cell-hover-bg);
}

.cell.revealed {
  border-style: inset;
  background-color: var(--cell-revealed-bg);
}

.cell.mine {
  background-color: #ff0000;
}

.cell.flagged {
  color: var(--flag-color);
}

.cell.adjacent-1 { color: blue; }
.cell.adjacent-2 { color: green; }
.cell.adjacent-3 { color: red; }
.cell.adjacent-4 { color: darkblue; }
.cell.adjacent-5 { color: brown; }
.cell.adjacent-6 { color: teal; }
.cell.adjacent-7 { color: black; }
.cell.adjacent-8 { color: gray; }

.game-message {
  margin-top: 15px;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px 20px;
  border-radius: 5px;
  animation: fadeIn 0.5s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>

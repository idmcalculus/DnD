import { KanbanBoard } from './components/KanbanBoard.js';

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Constants
  const ITEM_HEIGHT = 50; // Height of each task item in pixels
  
  // Get DOM elements
  const kanbanContainer = document.getElementById('kanban-container');
  const columnTemplate = document.getElementById('column-template');
  const itemTemplate = document.getElementById('item-template');
  const newTaskInput = document.getElementById('new-task-input');
  const addTaskBtn = document.getElementById('add-task-btn');
  const columnSelect = document.getElementById('column-select');
  
  // Create the kanban board
  const board = new KanbanBoard({
    container: kanbanContainer,
    columnTemplate: columnTemplate,
    itemTemplate: itemTemplate,
    data: window.kanbanData,
    itemHeight: ITEM_HEIGHT,
    onItemMove: (data) => {
      console.log('Item moved:', data);
      // You could save to a server here
    }
  });
  
  // Add task input functionality
  addTaskBtn.addEventListener('click', addNewTask);
  newTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addNewTask();
    }
  });
  
  /**
   * Add a new task to the board
   */
  function addNewTask() {
    const taskText = newTaskInput.value.trim();
    if (taskText) {
      const selectedColumnId = parseInt(columnSelect.value);
      
      // Add the task to the board
      const newItem = board.addNewTask(taskText, selectedColumnId);
      
      if (newItem) {
        console.log('New task added:', newItem);
        // You could save to a server here
      }
      
      // Clear input
      newTaskInput.value = '';
      newTaskInput.focus();
    }
  }
  
  // Expose the board to the window for debugging
  window.kanbanBoard = board;
}); 
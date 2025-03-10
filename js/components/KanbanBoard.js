import { VirtualScroller } from '../core/VirtualScroller.js';
import { DragManager } from '../core/DragManager.js';
import { debounce } from '../utils/performance.js';

/**
 * KanbanBoard - Manages a virtualized kanban board with drag-and-drop
 * Integrates VirtualScroller and DragManager for optimal performance
 */
export class KanbanBoard {
  /**
   * Create a kanban board
   * @param {Object} options - Configuration options
   * @param {HTMLElement} options.container - Container element for the board
   * @param {HTMLTemplateElement} options.columnTemplate - Template for columns
   * @param {HTMLTemplateElement} options.itemTemplate - Template for items
   * @param {Object} options.data - Initial data for the board
   * @param {number} options.itemHeight - Height of each item in pixels
   * @param {Function} options.onItemMove - Callback when an item is moved
   */
  constructor(options) {
    this.options = options;
    this.container = options.container;
    this.columnTemplate = options.columnTemplate;
    this.itemTemplate = options.itemTemplate;
    this.data = options.data || { columns: [] };
    this.ITEM_HEIGHT = options.itemHeight || 50;
    
    this.scrollers = new Map(); // Map of column ID to VirtualScroller
    
    // Create drag manager
    this.dragManager = new DragManager({
      onDragStart: this.handleDragStart.bind(this),
      onDrop: this.handleDrop.bind(this),
      itemHeight: this.ITEM_HEIGHT
    });
    
    // Bind methods
    this.renderItem = this.renderItem.bind(this);
    this.equalizeColumnHeights = debounce(this.equalizeColumnHeights.bind(this), 100);
    
    // Initialize the board
    this.initializeBoard();
    
    // Equalize column heights after initialization
    this.equalizeColumnHeights();
    
    // Add window resize listener for responsive adjustments
    window.addEventListener('resize', this.equalizeColumnHeights);
  }
  
  /**
   * Initialize the board with columns
   */
  initializeBoard() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create columns
    this.data.columns.forEach(column => {
      const columnElement = this.columnTemplate.content.cloneNode(true).children[0];
      columnElement.dataset.columnId = column.id;
      
      const titleElement = columnElement.querySelector('.column-title');
      titleElement.textContent = column.title;
      
      const virtualScrollContainer = columnElement.querySelector('.virtual-scroll-container');
      const scrollContent = columnElement.querySelector('.scroll-content');
      const droppableList = columnElement.querySelector('.droppable-list');
      
      // Ensure droppable list has the data-droppable attribute
      droppableList.setAttribute('data-droppable', 'true');
      droppableList.dataset.columnId = column.id;
      
      // Set up virtual scrolling for this column
      const scroller = new VirtualScroller(
        virtualScrollContainer,
        scrollContent,
        droppableList,
        column.items,
        this.renderItem,
        this.ITEM_HEIGHT
      );
      
      // Store the scroller for later use
      this.scrollers.set(column.id, scroller);
      
      this.container.appendChild(columnElement);
    });
  }
  
  /**
   * Render a single item
   * @param {Object} item - Item data
   * @param {number} index - Item index
   * @param {number} itemHeight - Height of the item
   * @returns {HTMLElement} - The rendered item element
   */
  renderItem(item, index, itemHeight) {
    const itemElement = this.itemTemplate.content.cloneNode(true).children[0];
    itemElement.textContent = item.text;
    itemElement.dataset.itemIndex = index;
    itemElement.dataset.itemId = item.id;
    itemElement.style.transform = `translateY(${index * itemHeight}px)`;
    itemElement.style.position = 'absolute';
    itemElement.style.width = 'calc(100% - 8px)';
    itemElement.style.left = '4px';
    
    // Make the item draggable
    this.dragManager.makeDraggable(itemElement, {
      id: item.id,
      index: index,
      text: item.text
    });
    
    return itemElement;
  }
  
  /**
   * Handle drag start event
   * @param {Object} data - Drag start data
   */
  handleDragStart(data) {
    // Store source column information for later use
    const sourceColumnId = parseInt(data.sourceList.dataset.columnId);
    data.item.dataset.sourceColumnId = sourceColumnId;
  }
  
  /**
   * Handle drop event
   * @param {Object} data - Drop data
   */
  handleDrop(data) {
    const sourceColumnId = parseInt(data.item.dataset.sourceColumnId);
    const targetColumnId = parseInt(data.targetList.dataset.columnId);
    const itemIndex = parseInt(data.item.dataset.itemIndex);
    const itemData = this.findItemById(sourceColumnId, data.data.id);
    
    if (!itemData) {
      console.error('Could not find item data for dropped item');
      return;
    }
    
    // Calculate target index based on drop position
    const targetIndex = data.targetIndex || Math.floor(data.position / this.ITEM_HEIGHT);
    
    // Check if it's a move within the same column
    const isSameColumn = sourceColumnId === targetColumnId;
    
    // Store this for animation
    const shouldAnimate = data.animate !== false;
    
    // Create a deep copy of the item to avoid reference issues
    const itemCopy = JSON.parse(JSON.stringify(itemData));
    
    // Preserve animation state before removing placeholders
    const sourceColumn = document.querySelector(`[data-column-id="${sourceColumnId}"]`);
    const targetColumn = document.querySelector(`[data-column-id="${targetColumnId}"]`);
    
    // Get current animation state
    const sourceItems = sourceColumn ? Array.from(sourceColumn.querySelectorAll('.draggable-item')) : [];
    const targetItems = targetColumn ? Array.from(targetColumn.querySelectorAll('.draggable-item')) : [];
    
    // Remove from source column
    this.removeItem(sourceColumnId, itemIndex, shouldAnimate && !isSameColumn);
    
    // Add to target column
    this.addItem(targetColumnId, targetIndex, itemCopy, shouldAnimate);
    
    // Call onItemMove callback if provided
    if (this.options.onItemMove) {
      this.options.onItemMove({
        item: itemCopy,
        sourceColumnId,
        targetColumnId,
        sourceIndex: itemIndex,
        targetIndex
      });
    }
    
    // Ensure animations are applied correctly
    setTimeout(() => {
      // Remove any leftover placeholders
      const placeholders = document.querySelectorAll('.placeholder');
      placeholders.forEach(placeholder => placeholder.remove());
      
      // Force a reflow on all columns to ensure clean state
      document.querySelectorAll('[data-column-id]').forEach(column => {
        void column.offsetHeight;
      });
      
      // Apply animations to the newly rendered items
      if (shouldAnimate) {
        const newTargetItems = targetColumn ? 
          Array.from(targetColumn.querySelectorAll('.draggable-item')) : [];
        
        if (newTargetItems.length > 0) {
          // Add inserted animation to the dropped item
          const droppedItem = newTargetItems.find(item => 
            item.dataset.itemId === String(itemCopy.id));
          
          if (droppedItem) {
            droppedItem.classList.add('item-inserted');
          }
          
          // Add moving animations to items around the insertion point
          newTargetItems.forEach((item) => {
            const itemRect = item.getBoundingClientRect();
            const isVisible = itemRect.top <= window.innerHeight && itemRect.bottom >= 0;
            const itemIndex = parseInt(item.dataset.itemIndex);
            
            if (!isVisible || isNaN(itemIndex)) return;
            
            if (itemIndex < targetIndex) {
              // Items above the insertion point move up slightly
              if (targetIndex - itemIndex <= 3) {
                item.classList.add('item-moving-up');
              }
            } else if (itemIndex > targetIndex) {
              // Items below the insertion point move down
              if (itemIndex - targetIndex <= 3) {
                item.classList.add('item-moving-down');
              }
            }
          });
          
          // Force position update on all items to prevent gaps
          const scroller = this.scrollers.get(targetColumnId);
          if (scroller && typeof scroller._positionAllItems === 'function') {
            scroller._positionAllItems();
          }
        }
      }
    }, 10);
    
    // Remove animation classes after animation completes and reposition items
    setTimeout(() => {
      document.querySelectorAll('.draggable-item').forEach(item => {
        item.classList.remove('item-moving-up', 'item-moving-down', 'item-inserted');
      });
      
      // Force final position update on all columns
      this.data.columns.forEach(column => {
        const scroller = this.scrollers.get(column.id);
        if (scroller && typeof scroller._positionAllItems === 'function') {
          scroller._positionAllItems();
        }
      });
    }, 600);
  }
  
  /**
   * Find an item by ID in a specific column
   * @param {number} columnId - Column ID
   * @param {number} itemId - Item ID
   * @returns {Object|null} - The item or null if not found
   */
  findItemById(columnId, itemId) {
    const column = this.data.columns.find(col => col.id === columnId);
    if (!column) return null;
    
    return column.items.find(item => item.id === itemId);
  }
  
  /**
   * Remove an item from a column
   * @param {number} columnId - Column ID
   * @param {number} index - Item index
   * @param {boolean} animate - Whether to animate the removal
   */
  removeItem(columnId, index, animate = false) {
    const column = this.data.columns.find(col => col.id === columnId);
    if (!column || index < 0 || index >= column.items.length) return;
    
    // If animating, trigger animations on items that will move up
    if (animate) {
      const columnElement = document.querySelector(`[data-column-id="${columnId}"]`);
      if (columnElement) {
        const items = columnElement.querySelectorAll('.draggable-item');
        // Animate all visible items below the removal point
        for (let i = index + 1; i < items.length; i++) {
          const rect = items[i].getBoundingClientRect();
          const isVisible = rect.top <= window.innerHeight && rect.bottom >= 0;
          if (isVisible) {
            items[i].classList.add('item-moving-up');
          }
        }
      }
    }
    
    // Remove the item
    column.items.splice(index, 1);
    
    // Ensure there are no null or undefined items in the array
    column.items = column.items.filter(item => item !== null && item !== undefined);
    
    // Update the virtual scroller
    const scroller = this.scrollers.get(columnId);
    if (scroller) {
      scroller.updateItems(column.items);
    }
    
    // Ensure any leftover placeholders are removed
    const placeholders = document.querySelectorAll('.placeholder');
    placeholders.forEach(placeholder => placeholder.remove());
  }
  
  /**
   * Add an item to a column
   * @param {number} columnId - Column ID
   * @param {number} index - Target index
   * @param {Object} item - Item data
   * @param {boolean} animate - Whether to animate the addition
   */
  addItem(columnId, index, item, animate = false) {
    const column = this.data.columns.find(col => col.id === columnId);
    if (!column) return;
    
    // Ensure index is valid
    const validIndex = Math.min(Math.max(0, index), column.items.length);
    
    // Insert the item at the specified index
    column.items.splice(validIndex, 0, item);
    
    // Ensure there are no null or undefined items in the array
    column.items = column.items.filter(item => item !== null && item !== undefined);
    
    // Ensure any leftover placeholders are removed before updating
    const placeholders = document.querySelectorAll('.placeholder');
    placeholders.forEach(placeholder => placeholder.parentNode && placeholder.parentNode.removeChild(placeholder));
    
    // Update the virtual scroller
    const scroller = this.scrollers.get(columnId);
    if (scroller) {
      // Update items immediately for better performance
      scroller.updateItems(column.items);
      
      // Force position update to prevent gaps
      if (typeof scroller._positionAllItems === 'function') {
        // Give the DOM a moment to update
        setTimeout(() => {
          scroller._positionAllItems();
        }, 0);
      }
      
      // If animating, add animation classes after a short delay to ensure DOM is updated
      if (animate) {
        setTimeout(() => {
          const columnElement = document.querySelector(`[data-column-id="${columnId}"]`);
          if (columnElement) {
            const items = columnElement.querySelectorAll('.draggable-item');
            
            // Find the newly inserted item by ID
            const insertedItem = Array.from(items).find(el => 
              el.dataset.itemId === String(item.id));
            
            if (insertedItem) {
              insertedItem.classList.add('item-inserted');
            }
            
            // Animate all visible items around the insertion point
            Array.from(items).forEach((itemEl) => {
              const rect = itemEl.getBoundingClientRect();
              const isVisible = rect.top <= window.innerHeight && rect.bottom >= 0;
              const itemIndex = parseInt(itemEl.dataset.itemIndex);
              
              if (!isVisible || isNaN(itemIndex)) return;
              
              if (itemIndex < validIndex) {
                // Items above the insertion point move up slightly
                if (validIndex - itemIndex <= 3) {
                  itemEl.classList.add('item-moving-up');
                }
              } else if (itemIndex > validIndex) {
                // Items below the insertion point move down
                itemEl.classList.add('item-moving-down');
              }
            });
            
            // Force another position update after animations are applied
            if (typeof scroller._positionAllItems === 'function') {
              scroller._positionAllItems();
            }
          }
        }, 10);
        
        // Remove animation classes and reposition after animation completes
        setTimeout(() => {
          if (typeof scroller._positionAllItems === 'function') {
            scroller._positionAllItems();
          }
        }, 300);
      }
    }
    
    // Equalize column heights
    this.equalizeColumnHeights();
  }
  
  /**
   * Add a new task to a column
   * @param {string} text - Task text
   * @param {number} columnId - Target column ID
   */
  addNewTask(text, columnId) {
    if (!text.trim()) return;
    
    const column = this.data.columns.find(col => col.id === columnId);
    if (!column) return;
    
    // Create new item
    const newItem = {
      id: Date.now(),
      text: text.trim()
    };
    
    // Add to column
    column.items.push(newItem);
    
    // Update the virtual scroller
    const scroller = this.scrollers.get(columnId);
    if (scroller) {
      scroller.updateItems(column.items);
    }
    
    // Equalize column heights
    this.equalizeColumnHeights();
    
    return newItem;
  }
  
  /**
   * Make all columns the same height as the tallest one
   */
  equalizeColumnHeights() {
    const droppableLists = document.querySelectorAll('.droppable-list');
    if (!droppableLists || droppableLists.length === 0) return;
    
    // Reset all list heights first
    droppableLists.forEach(list => {
      if (list) list.style.minHeight = '';
    });
    
    // Let the browser recalculate natural heights
    setTimeout(() => {
      try {
        // Find the height of each column based on its items
        let maxContentHeight = 0;
        
        // First pass: find the column with the tallest content
        droppableLists.forEach(list => {
          if (!list) return;
          
          // Calculate height based on actual items
          const items = list.querySelectorAll('.draggable-item');
          let contentHeight = 0;
          
          if (items.length > 0) {
            items.forEach(item => {
              if (item) {
                contentHeight += item.offsetHeight + 8; // 8px for margin-bottom
              }
            });
          }
          
          // Update max height if this list has taller content
          if (contentHeight > maxContentHeight) {
            maxContentHeight = contentHeight;
          }
        });
        
        // Make sure we have a minimum height even if all columns are empty
        if (maxContentHeight < 100) {
          maxContentHeight = 100; // Minimum height of 100px
        }
        
        // Second pass: set all lists to the height of the tallest content
        droppableLists.forEach(list => {
          if (list) {
            list.style.minHeight = `${maxContentHeight}px`;
          }
        });
      } catch (error) {
        console.error('Error in equalizeColumnHeights:', error);
      }
    }, 0);
  }
  
  /**
   * Get the current board data
   * @returns {Object} - The current board data
   */
  getData() {
    return this.data;
  }
  
  /**
   * Update the board with new data
   * @param {Object} newData - New board data
   */
  updateData(newData) {
    this.data = newData;
    
    // Clean up old scrollers
    this.scrollers.forEach(scroller => {
      scroller.destroy();
    });
    this.scrollers.clear();
    
    // Reinitialize the board
    this.initializeBoard();
    this.equalizeColumnHeights();
  }
  
  /**
   * Clean up event listeners and resources
   */
  destroy() {
    // Clean up scrollers
    this.scrollers.forEach(scroller => {
      scroller.destroy();
    });
    
    // Clean up drag manager
    this.dragManager.destroy();
    
    // Remove resize listener
    window.removeEventListener('resize', this.equalizeColumnHeights);
  }
} 
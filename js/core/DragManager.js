/**
 * DragManager - Handles drag and drop operations with animations
 * Optimized for performance with requestAnimationFrame and minimal DOM operations
 */
export class DragManager {
  /**
   * Create a drag manager
   * @param {Object} options - Configuration options
   * @param {Function} options.onDragStart - Callback when drag starts
   * @param {Function} options.onDragMove - Callback during drag
   * @param {Function} options.onDragEnd - Callback when drag ends
   * @param {Function} options.onDrop - Callback when item is dropped
   * @param {Function} options.getItemHeight - Function to get item height
   */
  constructor(options = {}) {
    this.options = options;
    this.draggedItem = null;
    this.sourceList = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.currentDropTarget = null;
    this.placeholder = null;
    this.placeholderIndex = -1;
    this.clone = null;
    this.dragActive = false;
    this.itemHeight = options.itemHeight || 50;
    
    // Bind methods to maintain context
    this.pointerDownHandler = this.pointerDownHandler.bind(this);
    this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
    this.pointerUpHandler = this.pointerUpHandler.bind(this);
    this.updateClonePosition = this.updateClonePosition.bind(this);
    this.createDragClone = this.createDragClone.bind(this);
    
    // Add global event listeners
    document.addEventListener('pointermove', this.pointerMoveHandler);
    document.addEventListener('pointerup', this.pointerUpHandler);
  }
  
  /**
   * Create a clone for visual feedback
   * @param {HTMLElement} element - The element to clone
   * @returns {HTMLElement} - The clone element
   */
  createDragClone(element) {
    const rect = element.getBoundingClientRect();
    const clone = element.cloneNode(true);
    clone.id = 'dragging-clone';
    clone.style.position = 'fixed'; // Use fixed positioning to follow cursor accurately
    clone.style.zIndex = '9999';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.95';
    clone.style.transformOrigin = 'center';
    clone.style.left = '0px'; // Will be set in updateClonePosition
    clone.style.top = '0px'; // Will be set in updateClonePosition
    clone.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.25)';
    clone.style.margin = '0';
    clone.style.transition = 'none'; // Remove transition for direct positioning
    return clone;
  }
  
  /**
   * Make an element draggable
   * @param {HTMLElement} element - Element to make draggable
   * @param {Object} data - Data associated with this draggable element
   */
  makeDraggable(element, data) {
    element.addEventListener('pointerdown', this.pointerDownHandler);
    element.dataset.dragData = JSON.stringify(data);
  }
  
  /**
   * Handle pointer down event to start dragging
   * @param {PointerEvent} e - The pointer event
   */
  pointerDownHandler(e) {
    try {
      // Only handle left mouse button (button 0)
      if (e.button !== 0) return;
      
      e.preventDefault();
      this.dragActive = true;
      this.draggedItem = e.currentTarget;
      this.sourceList = this.draggedItem.closest('[data-droppable="true"]');
      
      if (!this.sourceList) {
        console.error('Could not find source list for dragged item');
        return;
      }
      
      // Get drag data
      const dragData = JSON.parse(this.draggedItem.dataset.dragData || '{}');
      
      // Calculate offset from the pointer to the top-left corner of the item
      const rect = this.draggedItem.getBoundingClientRect();
      this.offsetX = e.clientX - rect.left;
      this.offsetY = e.clientY - rect.top;
      
      // Create a clone for visual feedback using the helper method
      this.clone = this.createDragClone(this.draggedItem);
      document.body.appendChild(this.clone);
      
      // Apply initial styles to make it appear to be picked up
      this.clone.style.transform = `scale(1.05) translateY(-5px)`;
      this.clone.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
      
      // Immediately position the clone at the cursor position
      this.updateClonePosition(e);
      
      // Force a reflow to ensure the clone is visible and positioned correctly
      this.clone.getBoundingClientRect();
      
      // Add visual feedback to the original item - make it nearly invisible while dragging
      this.draggedItem.style.opacity = '0.1';
      
      // Create placeholder for drop target indication
      this.createPlaceholder();
      
      // Highlight droppable areas
      document.querySelectorAll('[data-droppable="true"]').forEach(list => {
        if (list === this.sourceList) {
          list.classList.add('source-highlight');
        } else {
          list.classList.add('target-highlight');
        }
      });
      
      // Call onDragStart callback if provided
      if (this.options.onDragStart) {
        this.options.onDragStart({
          item: this.draggedItem,
          sourceList: this.sourceList,
          data: dragData,
          event: e
        });
      }
    } catch (error) {
      console.error('Error in pointerDownHandler:', error);
      this.cleanupDrag(); // Clean up in case of error
    }
  }
  
  /**
   * Create placeholder element for drop target indication
   */
  createPlaceholder() {
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'drop-placeholder';
    this.placeholder.style.height = `${this.itemHeight}px`;
    this.placeholder.style.display = 'none'; // Initially hidden
    this.placeholder.style.animation = 'pulse 1.5s infinite';
    this.placeholder.style.backgroundColor = 'rgba(0, 120, 215, 0.2)';
    this.placeholder.style.borderRadius = '4px';
    this.placeholder.style.border = '2px dashed rgba(0, 120, 215, 0.5)';
  }
  
  /**
   * Handle pointer move event during dragging
   * @param {PointerEvent} e - The pointer event
   */
  pointerMoveHandler(e) {
    if (!this.dragActive || !this.draggedItem) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Immediately update the clone position for responsive dragging
    if (this.clone) {
      // Direct DOM manipulation for immediate response
      this.updateClonePosition(e);
    }
    
    // Safety check - if drag was canceled or item was removed, exit early
    if (!this.draggedItem || !document.body.contains(this.draggedItem)) {
      this.cleanupDrag();
      return;
    }
    
    // Use requestAnimationFrame for smoother animation of other elements
    requestAnimationFrame(() => {
      try {
        // Safety check again inside the animation frame
        if (!this.dragActive || !this.draggedItem) return;
        
        // Find the droppable list under the pointer
        const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
        const dropList = elementsUnderPointer.find(el => el && el.hasAttribute && el.hasAttribute('data-droppable'));
        
        // Update highlighting
        if (dropList !== this.currentDropTarget) {
          // Remove placeholder from previous target
          this.removePlaceholder();
          
          // Remove highlight from previous target
          if (this.currentDropTarget && this.currentDropTarget !== this.sourceList) {
            this.currentDropTarget.classList.remove('active-highlight');
            
            // Remove animation classes from previous target items
            if (this.currentDropTarget) {
              const prevItems = this.currentDropTarget.querySelectorAll('.draggable-item');
              prevItems.forEach(item => {
                item.classList.remove('item-moving-up', 'item-moving-down');
                item.style.transitionDelay = '0s';
              });
            }
          }
          
          // Add highlight to new target
          if (dropList && dropList !== this.sourceList) {
            dropList.classList.add('active-highlight');
          }
          
          // Create placeholder for the new target if we have a valid drop target
          if (dropList) {
            this.createPlaceholder();
          }
          
          this.currentDropTarget = dropList;
          
          // Call onDragMove callback if provided
          if (this.options.onDragMove) {
            this.options.onDragMove({
              item: this.draggedItem,
              sourceList: this.sourceList,
              targetList: this.currentDropTarget,
              event: e
            });
          }
        }
        
        // Update placeholder position in the current target
        if (this.currentDropTarget && this.dragActive && this.draggedItem) {
          this.updatePlaceholderPosition(e, this.currentDropTarget);
        }
        
        // Auto-scroll when near the edges
        if (dropList && this.dragActive) {
          const container = dropList.closest('.virtual-scroll-container');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const scrollSpeed = 10;
            
            if (e.clientY < containerRect.top + 50) {
              container.scrollTop -= scrollSpeed;
            } else if (e.clientY > containerRect.bottom - 50) {
              container.scrollTop += scrollSpeed;
            }
          }
        }
      } catch (error) {
        console.error('Error in pointerMoveHandler:', error);
      }
    });
  }
  
  /**
   * Update the placeholder position based on mouse position
   * @param {PointerEvent} e - The pointer event
   * @param {HTMLElement} dropList - The drop target list
   */
  updatePlaceholderPosition(e, dropList) {
    // Multiple safety checks
    if (!dropList || !e || !this.dragActive || !this.draggedItem) return;
    
    // Create placeholder if it doesn't exist
    if (!this.placeholder) {
      this.createPlaceholder();
    }
    
    if (!this.placeholder) return; // Safety check
    
    const rect = dropList.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const newIndex = Math.floor(relativeY / this.itemHeight);
    
    // If index changed, update placeholder position
    if (newIndex !== this.placeholderIndex) {
      // Calculate actual visual position accounting for visible items
      this.removePlaceholder();
      
      // Create placeholder if it was removed
      if (!this.placeholder) {
        this.createPlaceholder();
      }
      
      if (!this.placeholder) return; // Another safety check
      
      // Add placeholder at new position
      let items = [];
      try {
        items = Array.from(dropList.querySelectorAll('.draggable-item') || []);
      } catch (err) {
        console.error('Error getting items:', err);
        return; // Exit if we can't get items
      }
      
      // Filter out the dragged item and null items
      const visibleItems = items.filter(item => item && item !== this.draggedItem);
      
      let insertBefore = null;
      if (newIndex < visibleItems.length) {
        insertBefore = visibleItems[newIndex];
      }
      
      // Show placeholder
      this.placeholder.style.display = 'block';
      
      // Animate items that need to move
      this.animateItemsForPlaceholder(dropList, newIndex);
      
      // Insert placeholder
      if (insertBefore) {
        dropList.insertBefore(this.placeholder, insertBefore);
      } else {
        dropList.appendChild(this.placeholder);
      }
      
      this.placeholderIndex = newIndex;
    }
  }
  
  /**
   * Animate items that need to move to make space for the placeholder
   * @param {HTMLElement} dropList - The drop target list
   * @param {number} placeholderIndex - The index where the placeholder will be inserted
   */
  animateItemsForPlaceholder(dropList, placeholderIndex) {
    if (!dropList || !this.dragActive || !this.draggedItem) return;
    
    let items = [];
    try {
      items = Array.from(dropList.querySelectorAll('.draggable-item') || []);
    } catch (err) {
      console.error('Error getting items for animation:', err);
      return; // Exit if we can't get items
    }
    
    // Filter out the dragged item and null items
    const visibleItems = items.filter(item => item && item !== this.draggedItem);
    
    // Reset all animations
    visibleItems.forEach(item => {
      item.classList.remove('item-moving-up', 'item-moving-down');
    });
    
    visibleItems.forEach((item, index) => {
      // Get the actual scroll container to determine visibility
      const scrollContainer = dropList.closest('.virtual-scroll-container');
      const scrollRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
      const itemRect = item.getBoundingClientRect();
      
      // Only animate items that are visible or just outside the viewport
      const isItemVisible = !scrollRect || (
        itemRect.bottom >= scrollRect.top - 100 && 
        itemRect.top <= scrollRect.bottom + 100
      );
      
      if (!isItemVisible) {
        return; // Skip animation for items not in view
      }
      
      // Animate items based on their position relative to the placeholder
      if (index < placeholderIndex) {
        // Only animate items close to the insertion point for better UX
        if (placeholderIndex - index <= 5) {
          item.classList.add('item-moving-up');
        }
      } else {
        // Items below the placeholder move down with more pronounced animation
        if (index - placeholderIndex <= 5) {
          item.classList.add('item-moving-down');
        }
      }
      
      // Apply a transition delay based on distance from placeholder for cascade effect
      const distance = Math.abs(index - placeholderIndex);
      const delay = Math.min(distance * 0.02, 0.1); // Max 100ms delay
      item.style.transitionDelay = `${delay}s`;
    });
  }
  
  /**
   * Remove the placeholder from DOM
   */
  removePlaceholder() {
    if (this.placeholder && this.placeholder.parentNode) {
      const parent = this.placeholder.parentNode;
      parent.removeChild(this.placeholder);
      
      // Force a reflow of the parent container to prevent ghost placeholders
      void parent.offsetHeight;
    }
    this.placeholder = null;
    this.placeholderIndex = -1;
  }
  
  /**
   * Update the position of the dragging clone
   * @param {PointerEvent} e - The pointer event
   */
  updateClonePosition(e) {
    if (this.clone) {
      // Calculate position relative to the document
      const x = e.clientX - this.offsetX;
      const y = e.clientY - this.offsetY;
      
      // Add a slight rotation effect based on movement direction for more natural feel
      const rotationFactor = 0.5; // Subtle rotation
      const movementX = e.movementX || 0;
      const rotation = movementX * rotationFactor;
      
      // Limit rotation to a small range
      const clampedRotation = Math.max(-3, Math.min(3, rotation));
      
      // Position the clone directly at the cursor position
      this.clone.style.position = 'fixed'; // Use fixed positioning to follow cursor
      this.clone.style.left = `${x}px`;
      this.clone.style.top = `${y}px`;
      this.clone.style.transform = `scale(1.05) rotate(${clampedRotation}deg) translateY(-5px)`;
    }
  }
  
  /**
   * Handle pointer up event to end dragging
   * @param {PointerEvent} e - The pointer event
   */
  pointerUpHandler(e) {
    if (!this.dragActive || !this.draggedItem) return;
    
    e.preventDefault();
    this.dragActive = false;
    
    // Immediately make the original item visible at its final position
    if (this.draggedItem) {
      this.draggedItem.style.opacity = '1';
    }
    
    // Find the droppable list under the pointer
    const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
    const dropList = elementsUnderPointer.find(el => el.hasAttribute('data-droppable'));
    
    // If we found a valid drop target
    if (dropList) {
      // Get drag data
      const dragData = JSON.parse(this.draggedItem.dataset.dragData || '{}');
      
      // Calculate drop position
      const mouseY = e.clientY;
      const containerRect = dropList.getBoundingClientRect();
      const relativeY = mouseY - containerRect.top;
      const targetIndex = Math.floor(relativeY / this.itemHeight);
      
      // Call onDrop callback if provided
      if (this.options.onDrop) {
        this.options.onDrop({
          item: this.draggedItem,
          sourceList: this.sourceList,
          targetList: dropList,
          data: dragData,
          position: relativeY,
          targetIndex: targetIndex,
          event: e,
          animate: true // Tell handler to animate the insertion
        });
      }
    }
    
    // Call onDragEnd callback if provided
    if (this.options.onDragEnd) {
      this.options.onDragEnd({
        item: this.draggedItem,
        sourceList: this.sourceList,
        event: e
      });
    }
    
    // Clean up
    this.cleanupDrag();
  }
  
  /**
   * Clean up after dragging
   */
  cleanupDrag() {
    try {
      // Remove the placeholder first to prevent ghost placeholders
      this.removePlaceholder();
      
      // Remove the clone immediately without animation for super fast, super lightweight functionality
      if (this.clone && this.clone.parentNode) {
        this.clone.parentNode.removeChild(this.clone);
      }
      this.clone = null;
      
      // Reset the original item immediately for super fast feedback
      if (this.draggedItem) {
        // Immediately restore opacity without animation
        this.draggedItem.style.transition = 'none';
        this.draggedItem.style.opacity = '1';
        this.draggedItem.style.transform = '';
        this.draggedItem.style.transitionDelay = '0s';
        
        // Force reflow to apply changes immediately
        void this.draggedItem.offsetWidth;
        
        // Reset transition after changes are applied
        setTimeout(() => {
          if (this.draggedItem) {
            this.draggedItem.style.transition = '';
          }
        }, 50);
      }
      
      // Force position update on all columns to prevent gaps
      document.querySelectorAll('[data-column-id]').forEach(column => {
        const columnId = parseInt(column.dataset.columnId);
        if (!isNaN(columnId)) {
          // Find the virtual scroller for this column
          const virtualScrollContainer = column.querySelector('.virtual-scroll-container');
          if (virtualScrollContainer) {
            const scrollContent = virtualScrollContainer.querySelector('.scroll-content');
            const list = virtualScrollContainer.querySelector('.droppable-list');
            
            if (list) {
              // Reset transition delays
              const allItems = list.querySelectorAll('.draggable-item');
              allItems.forEach(item => {
                // Remove all animation classes
                item.classList.remove('item-moving-up', 'item-moving-down');
                item.style.transitionDelay = '0s';
                
                // Add highlight animation to the recently dropped item
                if (this.draggedItem && item === this.draggedItem) {
                  item.classList.add('item-inserted');
                  
                  // Remove the class after animation completes
                  setTimeout(() => {
                    if (item) {
                      item.classList.remove('item-inserted');
                    }
                  }, 1000);
                }
              });
              
              // Force position update on all items
              const items = list.querySelectorAll('.draggable-item');
              items.forEach(item => {
                const itemIndex = parseInt(item.dataset.itemIndex);
                if (!isNaN(itemIndex)) {
                  // Calculate correct position
                  const topPosition = itemIndex * this.itemHeight;
                  
                  // Apply correct position
                  item.style.transform = `translateY(${topPosition}px)`;
                  item.style.position = 'absolute';
                  item.style.width = 'calc(100% - 8px)';
                  item.style.left = '4px';
                  
                  // Force reflow
                  void item.offsetHeight;
                }
              });
            }
          }
        }
      });
      
      // Gradually remove animation classes from items for a smoother experience
      setTimeout(() => {
        document.querySelectorAll('.draggable-item').forEach(item => {
          item.classList.remove('item-moving-up', 'item-moving-down', 'item-inserted');
        });
        
        // Remove all highlight classes from droppable areas
        document.querySelectorAll('[data-droppable="true"]').forEach(list => {
          list.classList.remove('source-highlight', 'target-highlight', 'active-highlight');
          
          // Force a reflow to ensure visual updates
          void list.offsetHeight;
        });
        
        // Final position update after animations complete
        document.querySelectorAll('[data-column-id]').forEach(column => {
          const columnId = parseInt(column.dataset.columnId);
          if (!isNaN(columnId)) {
            const list = column.querySelector('.droppable-list');
            if (list) {
              const items = list.querySelectorAll('.draggable-item');
              items.forEach(item => {
                const itemIndex = parseInt(item.dataset.itemIndex);
                if (!isNaN(itemIndex)) {
                  item.style.transform = `translateY(${itemIndex * this.itemHeight}px)`;
                }
              });
            }
          }
        });
      }, 300); // Allow animations to complete before removing classes
      
      // Reset drag state
      this.dragActive = false;
      this.draggedItem = null;
      this.sourceList = null;
      this.currentDropTarget = null;
    } catch (error) {
      console.error('Error in cleanupDrag:', error);
      
      // Force cleanup in case of error
      if (this.placeholder && this.placeholder.parentNode) {
        this.placeholder.parentNode.removeChild(this.placeholder);
      }
      
      if (this.clone && this.clone.parentNode) {
        this.clone.parentNode.removeChild(this.clone);
      }
      
      document.querySelectorAll('[data-droppable="true"]').forEach(list => {
        list.classList.remove('source-highlight', 'target-highlight', 'active-highlight');
      });
      
      document.querySelectorAll('.draggable-item').forEach(item => {
        item.classList.remove('item-moving-up', 'item-moving-down', 'item-inserted');
      });
    }
  }
  
  /**
   * Clean up event listeners
   */
  destroy() {
    document.removeEventListener('pointermove', this.pointerMoveHandler);
    document.removeEventListener('pointerup', this.pointerUpHandler);
  }
} 
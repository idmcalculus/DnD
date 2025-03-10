/**
 * VirtualScroller - Efficient virtualized scrolling implementation
 * Renders only visible items plus a buffer to optimize performance
 */
export class VirtualScroller {
  /**
   * Create a virtual scroller
   * @param {HTMLElement} container - The scrollable container
   * @param {HTMLElement} scrollContent - Element that provides scroll height
   * @param {HTMLElement} list - Element where visible items are rendered
   * @param {Array} items - Data items to render
   * @param {Function} renderItemFn - Function to render a single item
   * @param {number} itemHeight - Height of each item in pixels
   * @param {number} bufferItems - Number of items to render above and below viewport
   */
  constructor(container, scrollContent, list, items, renderItemFn, itemHeight = 50, bufferItems = 5) {
    this.container = container;
    this.scrollContent = scrollContent;
    this.list = list;
    this.items = items;
    this.renderItemFn = renderItemFn;
    this.ITEM_HEIGHT = itemHeight;
    this.BUFFER_ITEMS = bufferItems;
    this.visibleItems = new Set();
    
    // Initialize
    this.updateScrollHeight();
    
    // Ensure we render after the DOM has fully initialized
    setTimeout(() => this.renderVisibleItems(), 0);
    
    // Bind methods
    this._handleScroll = this._handleScroll.bind(this);
    
    // Add scroll listener
    this.container.addEventListener('scroll', this._handleScroll);
  }
  
  /**
   * Update the scroll content height based on total items
   */
  updateScrollHeight() {
    if (this.scrollContent && this.items) {
      this.scrollContent.style.height = `${this.items.length * this.ITEM_HEIGHT}px`;
    }
  }
  
  /**
   * Render only the items that are visible in the viewport plus buffer
   */
  renderVisibleItems() {
    if (!this.container || !this.list || !this.items) return;
    
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight || this.container.getBoundingClientRect().height;
    
    // Calculate how many items can fit in the visible container
    const visibleItemCount = Math.ceil(containerHeight / this.ITEM_HEIGHT);
    
    // Use a larger buffer initially to ensure all visible items are rendered
    const effectiveBuffer = Math.max(this.BUFFER_ITEMS, visibleItemCount);
    
    const startIndex = Math.max(0, Math.floor(scrollTop / this.ITEM_HEIGHT) - effectiveBuffer);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / this.ITEM_HEIGHT) + effectiveBuffer
    );
    
    // Check for any placeholders and remove them thoroughly
    const placeholders = this.list.querySelectorAll('.placeholder');
    if (placeholders.length > 0) {
      placeholders.forEach(placeholder => {
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
      });
      
      // Force a reflow to ensure clean state
      void this.list.offsetHeight;
    }
    
    // Create a document fragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    const currentItems = new Set();
    
    // Remove items that are no longer visible
    Array.from(this.visibleItems).forEach(index => {
      if (index < startIndex || index >= endIndex) {
        const item = this.list.querySelector(`[data-item-index="${index}"]`);
        if (item) {
          // Check if the item has animation classes
          const hasAnimation = item.classList.contains('item-moving-up') || 
                              item.classList.contains('item-moving-down') || 
                              item.classList.contains('item-inserted');
          
          if (!hasAnimation) {
            item.remove();
          } else {
            // For animated items, wait for animation to complete
            setTimeout(() => {
              if (item.parentNode) {
                item.parentNode.removeChild(item);
              }
            }, 300);
          }
        }
        this.visibleItems.delete(index);
      } else {
        // Keep track of items that should remain
        currentItems.add(index);
      }
    });
    
    // Add newly visible items
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.visibleItems.has(i) && this.items[i]) {
        try {
          const item = this.renderItemFn(this.items[i], i, this.ITEM_HEIGHT);
          
          // Set the correct position immediately
          item.style.transform = `translateY(${i * this.ITEM_HEIGHT}px)`;
          item.style.position = 'absolute';
          item.style.width = 'calc(100% - 8px)';
          item.style.left = '4px';
          
          fragment.appendChild(item);
          this.visibleItems.add(i);
        } catch (error) {
          console.error('Error rendering item:', error);
        }
      }
    }
    
    // Append all new items at once
    if (fragment.childNodes.length > 0) {
      this.list.appendChild(fragment);
    }
    
    // Ensure all items are positioned correctly
    this._positionAllItems();
  }
  
  /**
   * Handle scroll events
   * @private
   */
  _handleScroll() {
    requestAnimationFrame(() => {
      this.renderVisibleItems();
    });
  }
  
  /**
   * Update the items data and re-render
   * @param {Array} newItems - New data items
   */
  updateItems(newItems) {
    // Store current animation states before clearing
    const animatedElements = new Map();
    const itemsWithAnimations = Array.from(this.list.querySelectorAll('.draggable-item[class*="item-"]'));
    
    // Store animation classes for each item by ID
    itemsWithAnimations.forEach(item => {
      const itemId = item.dataset.itemId;
      const classes = Array.from(item.classList).filter(cls => 
        cls.includes('item-moving') || cls.includes('item-inserted')
      );
      
      if (classes.length > 0 && itemId) {
        animatedElements.set(itemId, classes);
      }
    });
    
    // Check if newItems is valid
    if (!Array.isArray(newItems)) {
      console.error('Invalid items array provided to updateItems');
      return;
    }
    
    // Update data
    this.items = newItems.filter(item => item !== null && item !== undefined);
    
    // Store the current scroll position
    const scrollTop = this.container.scrollTop;
    
    // Clear all existing items
    while (this.list.firstChild) {
      this.list.removeChild(this.list.firstChild);
    }
    
    this.visibleItems.clear();
    this.updateScrollHeight();
    
    // Force a reflow before rendering to prevent ghost elements
    void this.list.offsetHeight;
    
    // Render items
    this.renderVisibleItems();
    
    // Ensure all items are positioned correctly
    this._positionAllItems();
    
    // Restore scroll position
    this.container.scrollTop = scrollTop;
    
    // Re-apply animation classes
    if (animatedElements.size > 0) {
      // Give the DOM a moment to update
      setTimeout(() => {
        // Find newly rendered items and apply stored animation classes
        this.list.querySelectorAll('.draggable-item').forEach(item => {
          const itemId = item.dataset.itemId;
          if (itemId && animatedElements.has(itemId)) {
            const classes = animatedElements.get(itemId);
            item.classList.add(...classes);
            
            // Remove animation classes after they've been applied
            setTimeout(() => {
              if (item && item.classList) {
                item.classList.remove(...classes);
                // Force repositioning after animation completes
                this._positionAllItems();
              }
            }, 300); // Match this with your CSS animation duration
          }
        });
      }, 10);
    }
  }
  
  /**
   * Position all visible items correctly to prevent gaps
   * @private
   */
  _positionAllItems() {
    const items = this.list.querySelectorAll('.draggable-item');
    items.forEach((item) => {
      const itemIndex = parseInt(item.dataset.itemIndex);
      if (!isNaN(itemIndex)) {
        // Calculate the correct position based on item index
        const topPosition = itemIndex * this.ITEM_HEIGHT;
        
        // Apply the correct position
        item.style.transform = `translateY(${topPosition}px)`;
        item.style.position = 'absolute';
        item.style.width = 'calc(100% - 8px)';
        item.style.left = '4px';
        
        // Force a reflow to apply the style immediately
        void item.offsetHeight;
      }
    });
  }
  
  /**
   * Clean up event listeners
   */
  destroy() {
    this.container.removeEventListener('scroll', this._handleScroll);
  }
} 
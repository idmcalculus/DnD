/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The time to wait in milliseconds
 * @param {boolean} immediate - Whether to call the function immediately
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const context = this;
    
    const later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle function to limit how often a function can be called
 * @param {Function} func - The function to throttle
 * @param {number} limit - The time limit in milliseconds
 * @returns {Function} - The throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  
  return function(...args) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Request animation frame with fallback
 * @param {Function} callback - The callback function
 * @returns {number} - The request ID
 */
export const raf = window.requestAnimationFrame || 
                   window.webkitRequestAnimationFrame || 
                   window.mozRequestAnimationFrame || 
                   function(callback) { 
                     return window.setTimeout(callback, 1000 / 60); 
                   };

/**
 * Cancel animation frame with fallback
 * @param {number} id - The request ID to cancel
 */
export const caf = window.cancelAnimationFrame || 
                   window.webkitCancelAnimationFrame || 
                   window.mozCancelAnimationFrame || 
                   function(id) { 
                     clearTimeout(id); 
                   };

/**
 * Create a document fragment from HTML string
 * @param {string} html - HTML string
 * @returns {DocumentFragment} - The document fragment
 */
export function createFragmentFromHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}

/**
 * Check if the browser supports passive event listeners
 * @returns {boolean|Object} - false if not supported, or an options object
 */
export const passiveSupported = (function() {
  let passive = false;
  
  try {
    const options = {
      get passive() {
        passive = true;
        return true;
      }
    };
    
    window.addEventListener('test', null, options);
    window.removeEventListener('test', null, options);
  } catch (err) {
    passive = false;
  }
  
  return passive ? { passive: true } : false;
})(); 
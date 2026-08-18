/* BLOOMING_REMOVE_DEMO_DATA_FLOW_V51 */
(() => {
  'use strict';
  if (window.__BL_REMOVE_DEMO_DATA_FLOW_V51__) return;
  window.__BL_REMOVE_DEMO_DATA_FLOW_V51__ = true;

  const normalize = value => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  function isDataFlowMessage(element) {
    const text = normalize(element.textContent);
    return text.includes('demo data flow:') &&
      text.includes('api gateway') &&
      text.includes('lambda') &&
      text.includes('dynamodb') &&
      text.includes('no payment or medical information is collected');
  }

  function smallestMatchingElement() {
    return [...document.querySelectorAll('p, aside, article, section, div')]
      .filter(isDataFlowMessage)
      .sort((left, right) => left.textContent.length - right.textContent.length)[0] || null;
  }

  function hasCustomerContent(element) {
    const text = normalize(element.textContent);
    return Boolean(text || element.querySelector(
      'form,img,video,iframe,canvas,svg,input,select,textarea,button,a[href]'
    ));
  }

  function removeMessage() {
    const message = smallestMatchingElement();
    if (!message) return false;

    const parent = message.parentElement;
    message.remove();

    // Collapse only empty wrappers created for this message. Never remove a
    // wrapper that contains the booking form or other customer-facing content.
    let node = parent;
    for (let depth = 0; node && node !== document.body && depth < 3; depth += 1) {
      if (node.id === 'booking' || node.querySelector('form')) break;
      if (hasCustomerContent(node)) break;
      const next = node.parentElement;
      node.remove();
      node = next;
    }

    document.documentElement.dataset.dataFlowV51 = 'removed';
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeMessage, { once: true });
  } else removeMessage();

  // Retry because legacy scripts may render the message after DOMContentLoaded.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    removeMessage();
    if (attempts >= 40) clearInterval(timer);
  }, 250);
})();

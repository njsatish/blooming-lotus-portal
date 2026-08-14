/* BLOOMING_VISIT_AND_TECH_CLEANUP_V50 */
(() => {
  'use strict';
  if (window.__BL_VISIT_CLEANUP_V50__) return;
  window.__BL_VISIT_CLEANUP_V50__ = true;

  const normalize = value => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  function elementWithExactText(text) {
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong')]
      .find(element => normalize(element.textContent) === text);
  }

  function smallestContainer(element, requiredText) {
    if (!element) return null;
    let node = element;
    while (node && node !== document.body) {
      const text = normalize(node.textContent);
      if (requiredText.every(fragment => text.includes(fragment))) {
        const matchingChildren = [...node.children].filter(child => {
          const childText = normalize(child.textContent);
          return requiredText.every(fragment => childText.includes(fragment));
        });
        if (!matchingChildren.length) return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function removeTechnicalCards() {
    const backendHeading = elementWithExactText('aws demo backend');
    const nextHeading = elementWithExactText('next phase');

    const backendCard = smallestContainer(backendHeading, [
      'aws demo backend',
      'requests are stored in dynamodb',
      'browser → api gateway http api'
    ]);
    const nextCard = smallestContainer(nextHeading, [
      'next phase',
      'easy to expand later',
      'live therapist time-slot calendar'
    ]);

    const possibleWrappers = [backendCard?.parentElement, nextCard?.parentElement]
      .filter(Boolean);

    backendCard?.remove();
    nextCard?.remove();

    // Remove the shared wrapper only when nothing customer-facing remains.
    [...new Set(possibleWrappers)].forEach(wrapper => {
      const remainingText = normalize(wrapper.textContent);
      const meaningful = wrapper.querySelector(
        'form,img,video,iframe,canvas,svg,input,select,textarea,button,a[href]'
      );
      if (!remainingText && !meaningful) wrapper.remove();
    });
  }

  function findVisitSection() {
    const existing = document.getElementById('visit-v50') ||
      document.getElementById('visit-v36');
    if (existing) return existing;

    const hours = elementWithExactText('hours');
    if (!hours) return null;

    let node = hours.closest('section') || hours.parentElement;
    while (node && node !== document.body) {
      const text = normalize(node.textContent);
      if (text.includes('hours') &&
          text.includes('location') &&
          text.includes('3214 electric')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function findContactSection() {
    const existing = document.getElementById('contact');
    if (existing) return existing.closest('section') || existing;

    const heading = [...document.querySelectorAll('h1,h2,h3,h4')]
      .find(element => {
        const text = normalize(element.textContent);
        return text === 'contact' ||
          text.includes('contact blooming lotus') ||
          text === 'get in touch';
      });
    return heading?.closest('section') || heading?.parentElement || null;
  }

  function moveVisitAboveContact() {
    const visit = findVisitSection();
    const contact = findContactSection();
    if (!visit || !contact || visit === contact ||
        visit.contains(contact) || contact.contains(visit)) return false;

    visit.id = 'visit-v50';
    contact.id = contact.id || 'contact';
    contact.insertAdjacentElement('beforebegin', visit);

    document.querySelectorAll('header a, nav a').forEach(link => {
      if (normalize(link.textContent) === 'visit') link.href = '#visit-v50';
    });
    return true;
  }

  function preserveBooking() {
    const booking = document.getElementById('booking');
    if (!booking) return;
    booking.hidden = false;
    booking.removeAttribute('aria-hidden');
    booking.style.removeProperty('display');
    booking.style.removeProperty('visibility');
    booking.style.removeProperty('opacity');
  }

  function apply() {
    removeTechnicalCards();
    moveVisitAboveContact();
    preserveBooking();
    document.documentElement.dataset.visitCleanupV50 = 'complete';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else apply();

  // Older enhancements can render after DOMContentLoaded, so re-apply briefly.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    apply();
    if (attempts >= 40) clearInterval(timer);
  }, 250);
})();

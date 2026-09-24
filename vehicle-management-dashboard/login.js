'use strict';
(() => {
  const form = document.querySelector('#loginForm');
  const error = document.querySelector('#loginError');
  const button = document.querySelector('#submitButton');
  fetch('api/index.php?route=session', { credentials:'same-origin' })
    .then(response => response.json())
    .then(state => { if (state.authenticated) window.location.replace('/'); })
    .catch(() => {});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const response = await fetch('api/index.php?route=login', {
        method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ username:form.elements.username.value, password:form.elements.password.value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in');
      form.elements.password.value = '';
      window.location.replace('index.php');
    } catch (reason) {
      error.textContent = reason instanceof TypeError ? 'Could not reach the local sign-in server.' : reason.message;
      error.hidden = false;
      form.elements.password.value = '';
      form.elements.password.focus();
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });
})();

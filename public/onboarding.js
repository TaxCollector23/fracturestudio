(function () {
  'use strict';

  const KEY = 'fracture_onboarding_complete';
  const DATA_KEY = 'fracture_onboarding_survey';

  function $(id) { return document.getElementById(id); }

  function returnTarget() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('return');
    if (target && target.startsWith('/') && !target.startsWith('//')) return target;
    return '/studio.html';
  }

  function collect() {
    const hear = $('hearAbout') ? $('hearAbout').value : '';
    return {
      heardAbout: hear,
      heardAboutOther: $('hearOther') ? $('hearOther').value.trim() : '',
      workType: $('workType') ? $('workType').value : '',
      productUpdates: Boolean($('productUpdates') && $('productUpdates').checked),
      completedAt: new Date().toISOString()
    };
  }

  function finish(message) {
    try {
      localStorage.setItem(KEY, 'true');
      localStorage.setItem(DATA_KEY, JSON.stringify(collect()));
    } catch (_) {}
    if ($('onboardingStatus')) $('onboardingStatus').textContent = message || 'Setup saved.';
    window.setTimeout(function () {
      window.location.href = returnTarget();
    }, 450);
  }

  async function authAction(label, task) {
    if ($('onboardingStatus')) $('onboardingStatus').textContent = label;
    try {
      await task();
      finish('Account connected. Opening Fracture Studio.');
    } catch (error) {
      if ($('onboardingStatus')) $('onboardingStatus').textContent = error && error.message ? error.message : 'This sign-in step could not finish.';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if ($('hearAbout')) {
      $('hearAbout').addEventListener('change', function () {
        if ($('hearOtherWrap')) $('hearOtherWrap').classList.toggle('hidden', $('hearAbout').value !== 'Other');
      });
    }
    if ($('finishOnboarding')) $('finishOnboarding').addEventListener('click', function () { finish('Setup saved.'); });
    if ($('onboardingGuest')) $('onboardingGuest').addEventListener('click', function () {
      if (window.FractureAuth && typeof window.FractureAuth.continueWithoutEmail === 'function') {
        window.FractureAuth.continueWithoutEmail();
      }
      finish('Guest setup saved.');
    });
    if ($('onboardingGoogle')) $('onboardingGoogle').addEventListener('click', function () {
      authAction('Opening Google sign in...', function () { return window.FractureAuth.signInGoogle(); });
    });
    if ($('onboardingEmailSignIn')) $('onboardingEmailSignIn').addEventListener('click', function () {
      authAction('Signing in...', function () {
        return window.FractureAuth.signInEmail($('onboardingEmail').value, $('onboardingPassword').value);
      });
    });
    if ($('onboardingEmailCreate')) $('onboardingEmailCreate').addEventListener('click', function () {
      authAction('Creating account...', function () {
        return window.FractureAuth.signUpEmail($('onboardingName').value, $('onboardingEmail').value, $('onboardingPassword').value);
      });
    });
  });
})();

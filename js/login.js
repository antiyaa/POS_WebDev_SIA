/* login.js – login form behavior */

$(function () {
  seedDemoData();

  // Already signed in? Go straight to the right dashboard.
  const current = Auth.user();
  if (current) {
    location.replace(Auth.landing(current.role));
    return;
  }

  // Demo account shortcuts
  $('.demo-chip').on('click', function () {
    $('#username').val($(this).data('user'));
    $('#password').val($(this).data('pass'));
    $('#login-error').prop('hidden', true);
  });

  $('#login-form').on('submit', function (e) {
    e.preventDefault();
    const user = Auth.login($('#username').val().trim(), $('#password').val());
    if (!user) {
      $('#login-error').prop('hidden', false);
      return;
    }
    location.replace(Auth.landing(user.role));
  });
});

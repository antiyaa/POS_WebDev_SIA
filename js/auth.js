/* auth.js – demo login session and role-based page guard */

const Auth = {
  login: function (username, password) {
    const user = PosDB.get('users', []).find(function (u) {
      return u.username === username && u.password === password;
    });
    if (!user) return null;
    sessionStorage.setItem('pos_session', JSON.stringify({
      id: user.id, username: user.username, name: user.name, role: user.role
    }));
    return user;
  },

  user: function () {
    try { return JSON.parse(sessionStorage.getItem('pos_session')); }
    catch (e) { return null; }
  },

  landing: function (role) {
    return role === 'admin' ? 'admin-dashboard.html' : 'cashier-dashboard.html';
  },

  /* Call at the top of a dashboard. Returns the user, or null after redirecting. */
  guard: function (role) {
    const u = this.user();
    if (!u) { location.replace('login.html'); return null; }
    if (u.role !== role) { location.replace(this.landing(u.role)); return null; }
    return u;
  },

  logout: function () {
    sessionStorage.removeItem('pos_session');
    location.replace('login.html');
  }
};

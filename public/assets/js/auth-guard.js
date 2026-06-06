(function () {
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

  if (!token || !currentUser) {
    window.location.replace('/components/login.html');
    return;
  }

  const path = window.location.pathname;

  if (path.startsWith('/admin') && currentUser.role !== 'admin') {
    alert('Anda tidak memiliki akses ke halaman admin.');
    window.location.replace('/components/login.html');
    return;
  }

  if (path.startsWith('/mentor') && currentUser.role !== 'mentor') {
    alert('Anda tidak memiliki akses ke halaman mentor.');
    window.location.replace('/components/login.html');
    return;
  }
})();
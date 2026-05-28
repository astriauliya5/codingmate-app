(function () {
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));

  if (!token || !currentUser) {
    window.location.href = '/';
    return;
  }

  const path = window.location.pathname;

  if (path.startsWith('/admin') && currentUser.role !== 'admin') {
    alert('Akses ditolak. Halaman ini khusus admin.');
    window.location.href = '/';
    return;
  }

  if (path.startsWith('/mentor') && currentUser.role !== 'mentor') {
    alert('Akses ditolak. Halaman ini khusus mentor.');
    window.location.href = '/';
    return;
  }
})();
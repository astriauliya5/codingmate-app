document.addEventListener('DOMContentLoaded', function () {
  loadSidebar();
});

async function loadSidebar() {
  try {
    const response = await fetch('/components/sidebar.html');
    const html = await response.text();

    document.getElementById('sidebar-container').innerHTML = html;

    setupSidebarUserInfo();
    setupLogout();
  } catch (error) {
    console.error('LOAD SIDEBAR ERROR:', error);
  }
}

function setupSidebarUserInfo() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser) return;

    const emailElement = document.querySelector('.sidebar .email');

    if (emailElement) {
      emailElement.textContent = `👤 ${currentUser.email || currentUser.username || 'Admin'}`;
      emailElement.href = '/admin/akun/profil.html';
    }
  } catch (error) {
    console.error('SETUP SIDEBAR USER INFO ERROR:', error);
  }
}

function setupLogout() {
  const logoutButton = document.querySelector('.sidebar .logout');

  if (!logoutButton) return;

  logoutButton.addEventListener('click', function () {
    const confirmed = confirm('Yakin ingin logout?');

    if (!confirmed) return;

    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');

    window.location.replace('/components/login.html');
  });
}

function openAdminProfile(event) {
  event.preventDefault();
  window.location.href = '/admin/akun/profil.html';
}
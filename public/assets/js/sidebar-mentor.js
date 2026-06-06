document.addEventListener('DOMContentLoaded', function () {
  loadSidebarMentor();
});

async function loadSidebarMentor() {
  try {
    const response = await fetch('/components/sidebar-mentor.html');
    const html = await response.text();

    document.getElementById('sidebar-container').innerHTML = html;

    setupSidebarMentorUserInfo();
    setupMentorLogout();
  } catch (error) {
    console.error('LOAD SIDEBAR MENTOR ERROR:', error);
  }
}

function setupSidebarMentorUserInfo() {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!currentUser) return;

    const emailElement = document.querySelector('.sidebar .email');

    if (emailElement) {
      emailElement.textContent = `👤 ${currentUser.email || currentUser.username || 'Mentor'}`;
      emailElement.href = '/mentor/akun/detail-akun.html';
    }
  } catch (error) {
    console.error('SETUP SIDEBAR MENTOR USER INFO ERROR:', error);
  }
}

function setupMentorLogout() {
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
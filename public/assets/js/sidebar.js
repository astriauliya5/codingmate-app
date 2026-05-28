document.addEventListener('DOMContentLoaded', function () {
  const sidebarContainer = document.getElementById('sidebar-container');

  if (!sidebarContainer) {
    console.error('Elemen #sidebar-container tidak ditemukan.');
    return;
  }

  fetch('/components/sidebar.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('File sidebar.html tidak ditemukan.');
      }
      return response.text();
    })
    .then(data => {
      sidebarContainer.innerHTML = data;
      setSidebarUserEmail();
    })
    .catch(error => {
      console.error('Sidebar gagal dimuat:', error);
    });
});

function setSidebarUserEmail() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const emailElement = document.querySelector('.email');

  if (!currentUser || !emailElement) return;

  emailElement.textContent = `👤 ${currentUser.email}`;
}
document.addEventListener('DOMContentLoaded', function () {
  const sidebarContainer = document.getElementById('sidebar-container');

  if (!sidebarContainer) {
    console.error('Elemen #sidebar-container tidak ditemukan.');
    return;
  }

  fetch('/components/sidebar-mentor.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('File sidebar mentor tidak ditemukan.');
      }
      return response.text();
    })
    .then(data => {
      sidebarContainer.innerHTML = data;
      setMentorProfileClick();
      setSidebarUserEmail();
    })
    .catch(error => {
      console.error('Sidebar mentor gagal dimuat:', error);
    });
});

function setMentorProfileClick() {
  const emailProfile = document.querySelector('.email');

  if (!emailProfile) return;

  emailProfile.addEventListener('click', function () {
    const mentorData = {
      username: 'mentor1',
      namaLengkap: 'Mentor 1',
      email: 'mentor1@gmail.com',
      noTelp: '081234567890',
      alamat: 'Yogyakarta'
    };

    localStorage.setItem('detailAkunMentorData', JSON.stringify(mentorData));
  });
}

function setSidebarUserEmail() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const emailElement = document.querySelector('.email');

  if (!currentUser || !emailElement) return;

  emailElement.textContent = `👤 ${currentUser.email}`;
}
// Show Detail Data Siswa
// Fungsi untuk menampilkan data siswa dan mengarahkan ke halaman detail
function showDetailSiswa(index) {
  window.location.href = `detail-data-siswa.html?id=${index}`
  fetch('dummyData.json')
    .then(response => response.json())
    .then(dataSiswa => {
      const siswa = dataSiswa[index];
      const modal = document.getElementById("detail-siswa-modal");
      const container = document.getElementById("siswa-detail-container");

      // Isi kontainer dengan data siswa
      container.innerHTML = `
        <div>
          <img src="${siswa.photo}" alt="Foto" />
        </div>
        <div><strong>Full Name:</strong> ${siswa.fullName}</div>
        <div><strong>Nickname:</strong> ${siswa.nickname}</div>
        <div><strong>Parent Name:</strong> ${siswa.parentName}</div>
        <div><strong>Born Date:</strong> ${siswa.bornaDate}</div>
        <div><strong>Age:</strong> ${siswa.age}</div>
        <div><strong>Tanggal Bergabung:</strong> ${siswa.joinedDate}</div>
        <div><strong>Lama Bergabung:</strong> ${siswa.duration}</div>
        <div><strong>Kelas Awal:</strong> ${siswa.initialClass}</div>
        <div><strong>Kelas Sekarang:</strong> ${siswa.currentClass}</div>
        <div><strong>No Telp:</strong> ${siswa.phone}</div>
        <div><strong>Kota:</strong> ${siswa.city}</div>
        <div><strong>Sekolah:</strong> ${siswa.school}</div>
        <div><strong>Alamat:</strong> ${siswa.address}</div>
        <div><strong>Email:</strong> ${siswa.email}</div>
        <div><strong>Gmaps:</strong> ${siswa.gmaps}</div>
      `;

      // Tampilkan modal
      modal.style.display = "block";
    });
}

// Close the Detail Data Siswa Modal
function closeDetailSiswa() {
  const modal = document.getElementById("detail-siswa-modal");
  modal.style.display = "none";
}
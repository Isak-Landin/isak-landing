document.addEventListener('DOMContentLoaded', function () {
  const tabUsers = document.getElementById('tab-users');
  const tabVps = document.getElementById('tab-vps');
  const usersTable = document.getElementById('users-table');
  const vpsTable = document.getElementById('vps-table');

  function switchTab(target) {
    if (target === 'users') {
      tabUsers.classList.add('active');
      tabVps.classList.remove('active');
      usersTable.classList.remove('hidden');
      vpsTable.classList.add('hidden');
    } else {
      tabVps.classList.add('active');
      tabUsers.classList.remove('active');
      vpsTable.classList.remove('hidden');
      usersTable.classList.add('hidden');
    }
  }

  tabUsers.addEventListener('click', () => switchTab('users'));
  tabVps.addEventListener('click', () => switchTab('vps'));

  // Fetch admin data securely
     fetch('/admin/api/dashboard-data', {
      credentials: 'same-origin' // <-- important!
    })
      .then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Status ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then(data => {
        populateUsers(data.users);
        populateVps(data.vps);
      })
      .catch(err => {
        alert("Failed to load admin data:\n" + err.message);
        console.error("Admin data fetch error:", err);
      });



  function populateUsers(users) {
    const tbody = usersTable.querySelector('tbody');
    tbody.innerHTML = '';
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.email}</td>
        <td>${user.vps_count}</td>
      `;
      tbody.appendChild(row);
    });
  }

  function populateVps(vpsList) {
    const tbody = vpsTable.querySelector('tbody');
    tbody.innerHTML = '';
    vpsList.forEach(vps => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${vps.hostname}</td>
        <td>${vps.ip_address}</td>
        <td>${vps.os}</td>
        <td>${vps.cpu_cores} cores</td>
        <td>${vps.ram_mb} MB</td>
        <td>${vps.owner_email}</td>
      `;
      tbody.appendChild(row);
    });
  }
});

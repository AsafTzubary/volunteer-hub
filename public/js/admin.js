async function init() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }
  const { username, role } = await res.json();
  if (role !== 'admin') {
    window.location.href = '/dashboard.html';
    return;
  }
  document.getElementById('my-profile-link').href = profileUrl(username);
  wireLogout();

  loadMembersByCategory();

  const now = new Date();
  const toVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const fromVal = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('filter-from').value = fromVal;
  document.getElementById('filter-to').value = toVal;

  loadRegistrationsByMonth(fromVal, toVal);

  document.getElementById('filter-apply').addEventListener('click', () => {
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;
    loadRegistrationsByMonth(from || undefined, to || undefined);
  });

  document.getElementById('filter-reset').addEventListener('click', () => {
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    loadRegistrationsByMonth();
  });
}

async function loadMembersByCategory() {
  const container = document.getElementById('chart-members-by-category');

  const res = await fetch('/api/stats/members-by-category');
  if (!res.ok) return;
  const allData = await res.json();

  if (!allData.length) {
    container.innerHTML = '<p class="text-muted small">No data available.</p>';
    return;
  }

  const tooltip = d3.select(container)
    .append('div')
    .style('position', 'absolute')
    .style('background', '#333')
    .style('color', '#fff')
    .style('padding', '4px 8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  d3.select(container).style('position', 'relative');

  const filtersEl = document.createElement('div');
  filtersEl.className = 'd-flex flex-wrap gap-1 mt-3';
  container.after(filtersEl);

  const selected = new Set(allData.map(d => d.category));

  function drawChart(data) {
    d3.select(container).select('svg').remove();

    if (!data.length) {
      container.innerHTML += '<p class="text-muted small" id="no-data-msg">No categories selected.</p>';
      return;
    }
    document.getElementById('no-data-msg')?.remove();

    const width = container.clientWidth || 400;
    const height = 260;
    const margin = { top: 20, right: 20, bottom: 80, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(data.map(d => d.category))
      .range([0, innerW])
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.memberCount)])
      .nice()
      .range([innerH, 0]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end')
      .style('font-size', '11px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5));

    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.category))
      .attr('y', d => y(d.memberCount))
      .attr('width', x.bandwidth())
      .attr('height', d => innerH - y(d.memberCount))
      .attr('fill', '#0d6efd')
      .attr('rx', 3)
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1)
          .html(`<strong>${d.category}</strong><br>${d.memberCount} members`);
      })
      .on('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        tooltip
          .style('left', (event.clientX - rect.left + 10) + 'px')
          .style('top', (event.clientY - rect.top - 28) + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0));
  }

  function renderButtons() {
    filtersEl.innerHTML = '';
    allData.forEach(d => {
      const btn = document.createElement('button');
      btn.textContent = d.category;
      btn.className = 'btn btn-sm ' + (selected.has(d.category) ? 'btn-primary' : 'btn-outline-secondary');
      btn.addEventListener('click', () => {
        if (selected.has(d.category)) {
          selected.delete(d.category);
        } else {
          selected.add(d.category);
        }
        renderButtons();
        drawChart(allData.filter(item => selected.has(item.category)));
      });
      filtersEl.appendChild(btn);
    });
  }

  renderButtons();
  drawChart(allData);
}

async function loadRegistrationsByMonth(from, to) {
  const container = document.getElementById('chart-registrations-by-month');
  d3.select(container).select('svg').remove();
  d3.select(container).select('.no-data-msg').remove();

  let url = '/api/stats/registrations-by-month';
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (params.toString()) url += '?' + params.toString();

  const res = await fetch(url);
  if (!res.ok) return;
  const data = await res.json();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  let startYear, startMonth, endYear, endMonth;
  if (from) {
    [startYear, startMonth] = from.split('-').map(Number);
  } else if (data.length) {
    startYear = data[0].year;
    startMonth = data[0].month;
  }
  if (to) {
    [endYear, endMonth] = to.split('-').map(Number);
  } else if (data.length) {
    endYear = data[data.length - 1].year;
    endMonth = data[data.length - 1].month;
  }

  if (!startYear) {
    d3.select(container).append('p')
      .attr('class', 'text-muted small no-data-msg')
      .text('No registration data for the selected period.');
    return;
  }

  const lookup = new Map(data.map(d => [`${d.year}-${d.month}`, d.count]));
  const filled = [];
  let cy = startYear, cm = startMonth;
  while (cy < endYear || (cy === endYear && cm <= endMonth)) {
    filled.push({ year: cy, month: cm, count: lookup.get(`${cy}-${cm}`) || 0 });
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }

  const labeled = filled.map(d => ({ ...d, label: `${monthNames[d.month - 1]} ${d.year}` }));

  const width = container.clientWidth || 400;
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 60, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint()
    .domain(labeled.map(d => d.label))
    .range([0, innerW])
    .padding(0.5);

  const y = d3.scaleLinear()
    .domain([0, d3.max(labeled, d => d.count)])
    .nice()
    .range([innerH, 0]);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-35)')
    .style('text-anchor', 'end')
    .style('font-size', '11px');

  g.append('g')
    .call(d3.axisLeft(y).ticks(5));

  g.append('path')
    .datum(labeled)
    .attr('fill', 'none')
    .attr('stroke', '#0d6efd')
    .attr('stroke-width', 2)
    .attr('d', d3.line()
      .x(d => x(d.label))
      .y(d => y(d.count))
    );

  const tooltip = d3.select(container)
    .append('div')
    .style('position', 'absolute')
    .style('background', '#333')
    .style('color', '#fff')
    .style('padding', '4px 8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  d3.select(container).style('position', 'relative');

  g.selectAll('circle')
    .data(labeled)
    .join('circle')
    .attr('cx', d => x(d.label))
    .attr('cy', d => y(d.count))
    .attr('r', 5)
    .attr('fill', '#0d6efd')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .on('mouseover', (event, d) => {
      tooltip.style('opacity', 1)
        .html(`<strong>${d.label}</strong><br>${d.count} registrations`);
    })
    .on('mousemove', (event) => {
      const rect = container.getBoundingClientRect();
      tooltip
        .style('left', (event.clientX - rect.left + 10) + 'px')
        .style('top', (event.clientY - rect.top - 28) + 'px');
    })
    .on('mouseout', () => tooltip.style('opacity', 0));
}

init();

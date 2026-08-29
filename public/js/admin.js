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

init();

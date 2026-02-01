(function () {
  const NAMES = ['chace', 'james', 'rui', 'john', 'emily'];
  const LOAN_TAKERS = ['james', 'rui', 'john', 'emily'];
  const BAR_COLORS = {
    chace: '#2563eb',
    james: '#16a34a',
    rui: '#ea580c',
    john: '#0891b2',
    emily: '#dc2626'
  };

  function formatCurrency(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }

  function formatPct(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / 100);
  }

  function annuityFactor(r, n) {
    if (r <= 0) return n;
    return (1 - Math.pow(1 + r, -n)) / r;
  }

  function loanFromPI(monthlyPI, annualRatePct, termYears) {
    const r = (annualRatePct / 100) / 12;
    const n = termYears * 12;
    const k = annuityFactor(r, n);
    return monthlyPI * k;
  }

  function piFromMonthlyAndDown(totalMonthly, downPayment, annualRatePct, termYears, overheadPct) {
    const r = (annualRatePct / 100) / 12;
    const n = termYears * 12;
    const k = annuityFactor(r, n);
    const overheadMonthly = overheadPct / 100 / 12;
    const numerator = totalMonthly - overheadMonthly * downPayment;
    const denominator = 1 + overheadMonthly * k;
    if (denominator <= 0) return 0;
    return numerator / denominator;
  }

  const LOAN_TERM_YEARS = 30;

  function getInputs() {
    const purchasePrice = Number(document.getElementById('purchase-price').value) || 0;
    const interestRate = Number(document.getElementById('interest-rate').value) || 0;
    const overheadPct = Number(document.getElementById('overhead-pct').value) || 0;
    const mode = document.querySelector('input[name="mode"]:checked').value;

    const down = {};
    const monthly = {};
    LOAN_TAKERS.forEach(name => {
      down[name] = Number(document.getElementById(`${name}-down`).value) || 0;
      if (mode === 'monthly') {
        monthly[name] = Number(document.getElementById(`${name}-monthly`).value) || 0;
      } else {
        const annualIncome = Number(document.getElementById(`${name}-annual-income`).value) || 0;
        const housingPct = Number(document.getElementById(`${name}-housing-pct`).value) || 0;
        monthly[name] = (annualIncome / 12) * (housingPct / 100);
      }
    });

    return { purchasePrice, interestRate, overheadPct, down, monthly };
  }

  function compute(inputs) {
    const { purchasePrice, interestRate, overheadPct, down, monthly } = inputs;
    const loanTerm = LOAN_TERM_YEARS;
    const contribution = {};
    const pi = {};
    const loan = {};
    const monthlyOverhead = {};

    LOAN_TAKERS.forEach(name => {
      const piVal = Math.max(0, piFromMonthlyAndDown(monthly[name], down[name], interestRate, loanTerm, overheadPct));
      pi[name] = piVal;
      loan[name] = loanFromPI(piVal, interestRate, loanTerm);
      contribution[name] = down[name] + loan[name];
    });

    const othersTotal = LOAN_TAKERS.reduce((sum, name) => sum + contribution[name], 0);
    contribution.chace = purchasePrice - othersTotal;

    const totalContrib = NAMES.reduce((sum, name) => sum + contribution[name], 0);
    const share = {};
    NAMES.forEach(name => {
      share[name] = purchasePrice > 0 ? (contribution[name] / purchasePrice) * 100 : 0;
      monthlyOverhead[name] = (overheadPct / 100 / 12) * contribution[name];
    });

    return {
      contribution,
      share,
      pi,
      loan,
      monthlyOverhead,
      othersTotal,
      purchasePrice
    };
  }

  function render(state) {
    const { contribution, share, pi, loan, monthlyOverhead, othersTotal, purchasePrice } = state;

    const warningEl = document.getElementById('warning');
    if (contribution.chace < 0) {
      warningEl.textContent = 'Others\' contributions exceed purchase price. Increase purchase price or reduce others\' down payments or monthly payments.';
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }

    document.getElementById('chace-contribution').textContent = formatCurrency(contribution.chace);
    document.getElementById('chace-share').textContent = formatPct(share.chace);
    document.getElementById('chace-monthly').textContent = formatCurrency(monthlyOverhead.chace);

    const totalLiquidity = contribution.chace + LOAN_TAKERS.reduce((sum, name) => sum + loan[name], 0);
    document.getElementById('chace-total-liquidity').textContent = formatCurrency(totalLiquidity);
    const liquidityParts = ['Chace ' + formatCurrency(contribution.chace)].concat(
      LOAN_TAKERS.map(name => name.charAt(0).toUpperCase() + name.slice(1) + ' ' + formatCurrency(loan[name]))
    );
    document.getElementById('chace-liquidity-breakdown').textContent = '(' + liquidityParts.join(' + ') + ')';

    LOAN_TAKERS.forEach(name => {
      document.getElementById(`${name}-share`).textContent = formatPct(share[name]);
      document.getElementById(`${name}-contribution`).textContent = formatCurrency(contribution[name]);
      document.getElementById(`${name}-down-val`).textContent = formatCurrency(state.contribution[name] - loan[name]);
      document.getElementById(`${name}-loan-val`).textContent = formatCurrency(loan[name]);
      document.getElementById(`${name}-monthly-total`).textContent = formatCurrency(pi[name] + monthlyOverhead[name]);
      document.getElementById(`${name}-pi`).textContent = formatCurrency(pi[name]);
      document.getElementById(`${name}-overhead`).textContent = formatCurrency(monthlyOverhead[name]);
    });

    const barsEl = document.getElementById('ownership-bars');
    barsEl.innerHTML = '';
    NAMES.forEach(name => {
      const pct = Math.max(0, share[name]);
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.flexGrow = pct;
      bar.style.backgroundColor = BAR_COLORS[name];
      bar.style.minWidth = pct > 0 ? '4px' : '0';
      bar.title = `${name}: ${formatPct(share[name])}`;
      barsEl.appendChild(bar);
    });

    const labelsEl = document.getElementById('ownership-labels');
    labelsEl.innerHTML = NAMES.map(n => {
      const label = `${n.charAt(0).toUpperCase() + n.slice(1)} ${formatPct(share[n])}`;
      return `<span style="color: ${BAR_COLORS[n]}">${label}</span>`;
    }).join('  ·  ');

    NAMES.forEach(name => {
      const h3 = document.querySelector(`.person-card[data-person="${name}"] h3`);
      if (h3) h3.style.color = BAR_COLORS[name];
    });
  }

  function run() {
    const inputs = getInputs();
    const state = compute(inputs);
    render(state);
  }

  function setModeClass() {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    document.body.className = 'mode-' + mode;
    run();
  }

  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', setModeClass);
  });

  const allInputIds = [
    'purchase-price', 'interest-rate', 'overhead-pct',
    ...LOAN_TAKERS.flatMap(n => [
      `${n}-down`, `${n}-monthly`,
      `${n}-annual-income`, `${n}-housing-pct`
    ])
  ];

  allInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', run);
      el.addEventListener('change', run);
    }
  });

  document.body.className = 'mode-monthly';
  run();
})();

// DOM Elements
const loginContainer = document.getElementById('login-container');
const profileContainer = document.getElementById('profile-container');
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const welcomeMessage = document.getElementById('welcome-message');
const userInfo = document.getElementById('user-info');
const xpDisplay = document.getElementById('xp-display');
const logoutBtn = document.getElementById('logout-btn');

// Login function
async function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const credentials = btoa(`${username}:${password}`);

    try {
        const response = await axios.post('https://adam-jerusalem.nd.edu/api/auth/signin', null, {
            headers: { 'Authorization': `Basic ${credentials}` }
        });

        const token = response.data;
        if (token && token.split('.').length === 3) {
            localStorage.setItem('jwt', token);
            localStorage.setItem('username', username);
            showProfilePage();
        } else {
            throw new Error('Invalid JWT token format');
        }
    } catch (error) {
        console.error('Login Error:', error);
        errorMessage.textContent = 'Invalid login credentials';
    }
}

// Show Profile Page
async function showProfilePage() {
    loginContainer.classList.add('hidden');
    profileContainer.classList.remove('hidden');
    await fetchProfileData(); // Fetch user data
    const username = localStorage.getItem('username');
    welcomeMessage.innerHTML = `Welcome, ${username}!`;
}

// Fetch User Data
async function fetchProfileData() {
    const token = localStorage.getItem('jwt');
    
    try {
        // Fetch user ID first
        const userIdResponse = await axios.post('https://adam-jerusalem.nd.edu/api/graphql-engine/v1/graphql', {
            query: `{ user { id } }`
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const userId = userIdResponse.data.data.user[0].id;
        
        const query = `{
            user(where: { id: { _eq: ${userId} } }) {
                id
                login
                firstName
                lastName
                auditRatio
                xps { path amount }
                audits { id }
                groups { id }
                transactions { createdAt amount type }
            }
        }`;

        const response = await axios.post('https://adam-jerusalem.nd.edu/api/graphql-engine/v1/graphql', { query }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data && response.data.data && response.data.data.user) {
            const user = response.data.data.user[0];

            localStorage.setItem('username', user.login);
            renderProfile(user);
            const totalXP = calculateTotalXP(user.xps);
            xpDisplay.innerHTML = `XP: ${totalXP} KB`;

            createPieChart(user.transactions);
            renderXPBarChart(user.transactions); 

        } else {
            throw new Error('User data is not available');
        }
    } catch (error) {
        console.error('Error fetching profile data:', error);
        errorMessage.textContent = 'Failed to fetch user data.';
    }
}

// Render User Profile
function renderProfile(user) {
    userInfo.innerHTML = `
        <p>ID: ${user.id}</p>
        <p>Login: ${user.login}</p>
        <p>Audits: ${user.audits.length}</p>
        <p>Groups: ${user.groups.length}</p>
        <p>Audit Ratio: ${user.auditRatio ? user.auditRatio.toFixed(1) : "N/A"}</p>
    `;
}

// Calculate Total XP (Modules only)
function calculateTotalXP(xps) {
    const modulePathRegex = /module(?!\/piscine)/i;
    const totalModuleXp = xps
        .filter(xp => modulePathRegex.test(xp.path))
        .reduce((sum, xp) => sum + xp.amount, 0);
    
    return ((totalModuleXp + 70000) / 1000).toFixed(0);
    }
    
    // Render XP bar chart using D3.js
    function renderXPBarChart(transactions) {
    d3.select("#xp-chart").selectAll("*").remove(); 
    
    const xpCategories = ["checkpoints", "programs", "piscine_go", "js_module"];
    
    const groupedData = d3.group(transactions, d => d3.timeFormat("%Y-%m-%d")(new Date(d.createdAt)));
    const formattedData = Array.from(groupedData, ([date, items]) => ({
        date: new Date(date),
        totalXP: items.reduce((sum, d) => sum + d.amount, 0) 
    })).sort((a, b) => a.date - b.date);
    
    const margin = { top: 50, right: 50, bottom: 100, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    
    const svg = d3.select("#xp-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    
    const defs = svg.append("defs");
    
    const gradient = defs.append("linearGradient")
        .attr("id", "xpGradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "var(--cosmic-blue)"); 
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "var(--cosmic-purple)"); 
    
    
    const x = d3.scaleTime()
        .domain(d3.extent(formattedData, d => d.date))
        .range([0, width]);
    
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(formattedData, d => d.totalXP)])
        .nice()
        .range([height, 0]);
    
    
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %d, %Y")))
        .selectAll("text")
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start")
        .style("font-size", "12px");
    
    
    svg.append("g")
        .call(d3.axisLeft(y));
    
    
    svg.selectAll(".bar")
        .data(formattedData)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.date))
        .attr("y", d => y(d.totalXP))
        .attr("width", 15) 
        .attr("height", d => height - y(d.totalXP))
        .attr("fill", "url(#xpGradient)"); 
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
    
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 60)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
    
    
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
    
    }
    
    
    
    // Create Skill Progress Pie Chart
    function createPieChart(transactions) {
    const skills = ['go', 'html', 'js', 'sql', 'css'];
    
    const skillData = transactions
        .filter(tx => tx.type.startsWith('skill_'))
        .reduce((acc, tx) => {
            const skillType = tx.type.replace('skill_', '');
            if (skills.includes(skillType)) {
                acc[skillType] = Math.max(acc[skillType] || 0, tx.amount);
            }
            return acc;
        }, {});
    
    if (Object.keys(skillData).length === 0) {
        document.getElementById('skillPieChart').innerHTML = "<p>No data available</p>";
        return;
    }
    
    const totalXP = Object.values(skillData).reduce((sum, val) => sum + val, 0);
    const labels = Object.keys(skillData);
    const data = Object.values(skillData).map(value => ((value / totalXP) * 100).toFixed(2));
    
    const ctx = document.getElementById('skillPieChart').getContext('2d');
    
    if (ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['red', 'blue', 'green', 'purple', 'orange'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: tooltipItem => `${tooltipItem.label}: ${tooltipItem.raw}%`
                    }
                }
            }
        }
    });
    }
    

// Logout function
function logout() {
    localStorage.clear();
    loginContainer.classList.remove('hidden');
    profileContainer.classList.add('hidden');
}

loginForm.addEventListener('submit', login);
logoutBtn.addEventListener('click', logout);
document.addEventListener('DOMContentLoaded', () => {
    localStorage.clear();
    loginContainer.classList.remove('hidden');
    profileContainer.classList.add('hidden');
});

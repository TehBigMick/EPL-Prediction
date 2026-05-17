// Initialize Supabase
const supabaseUrl = "https://reqoykoevyggemmspszc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlcW95a29ldnlnZ2VtbXNwc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzAyNTksImV4cCI6MjA5NDUwNjI1OX0.70dkxT--W5zbc4vWYcusrhzpivmSLbuP3GQNqxKNlLw";

supabase = supabase.createClient(supabaseUrl, supabaseKey);

let CURRENT_USER_ID = null;

// Login handler
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = prompt("Enter your email:");
  const password = prompt("Enter your password:");
  if (!email || !password) return;

  const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) return alert("Login failed: " + loginError.message);

  CURRENT_USER_ID = signInData.user.id;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", CURRENT_USER_ID)
    .single();

  if (userError || !user) {
    alert("No matching row found in users table. Please add this Auth user to the table.");
    return;
  }

  document.getElementById("user-name").textContent = `Logged in as ${user.display_name}`;
  document.getElementById("tables-container").style.display = "flex";

  loadMatches();
  loadLeaderboard();
  subscribeRealtime();
});

// Load matches
async function loadMatches() {
  if (!CURRENT_USER_ID) return;

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: true });

  if (matchesError || !matches) {
    console.error("Failed to load matches", matchesError);
    return;
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", CURRENT_USER_ID);

  const predictionsMap = {};
  if (predictions) predictions.forEach(p => { predictionsMap[p.match_id] = p; });

  const tbody = document.querySelector("#matches-table tbody");
  tbody.innerHTML = "";

  matches.forEach(match => {
    const pred = predictionsMap[match.id];
    const homeVal = pred ? pred.predicted_home : "";
    const awayVal = pred ? pred.predicted_away : "";

    const row = document.createElement("tr");
    row.dataset.matchId = match.id;
    row.innerHTML = `
      <td>${match.home_team}</td>
      <td>${match.away_team}</td>
      <td>${new Date(match.match_date).toLocaleString()}</td>
      <td>
        <input type="number" id="home-${match.id}" value="${homeVal}" ${match.is_locked ? "disabled" : ""}>
        -
        <input type="number" id="away-${match.id}" value="${awayVal}" ${match.is_locked ? "disabled" : ""}>
      </td>
      <td>${match.home_score ?? "-"} - ${match.away_score ?? "-"}</td>
    `;
    tbody.appendChild(row);
  });
}

// Submit all predictions
async function submitAllPredictions() {
  const rows = document.querySelectorAll("#matches-table tbody tr");

  for (let row of rows) {
    const matchId = row.dataset.matchId;
    const homeScore = parseInt(row.querySelector(`input[id^="home-"]`).value);
    const awayScore = parseInt(row.querySelector(`input[id^="away-"]`).value);

    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    const { data: existing } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", CURRENT_USER_ID)
      .eq("match_id", matchId)
      .single();

    if (existing) {
      await supabase.from("predictions").update({ predicted_home: homeScore, predicted_away: awayScore }).eq("id", existing.id);
    } else {
      await supabase.from("predictions").insert([{ user_id: CURRENT_USER_ID, match_id: matchId, predicted_home: homeScore, predicted_away: awayScore }]);
    }
  }

  loadMatches();
  loadLeaderboard();
}

// Leaderboard
async function loadLeaderboard() {
  const { data: leaderboard } = await supabase
    .from("users")
    .select("*")
    .order("total_points", { ascending: false });

  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = "";

  if (!leaderboard) return;

  leaderboard.forEach((user, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i + 1}</td><td>${user.display_name}</td><td>${user.total_points}</td>`;
    tbody.appendChild(row);
  });
}

// Realtime updates
function subscribeRealtime() {
  const usersChannel = supabase
    .channel('public:users')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => loadLeaderboard())
    .subscribe();

  const matchesChannel = supabase
    .channel('public:matches')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => loadMatches())
    .subscribe();

  window._supabaseUsersChannel = usersChannel;
  window._supabaseMatchesChannel = matchesChannel;
}

// Bind the single submit button
document.getElementById("submit-all-btn").addEventListener("click", submitAllPredictions);

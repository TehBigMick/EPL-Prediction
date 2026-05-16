// Initialize Supabase (plain JS)
const supabaseUrl = "https://reqoykoevyggemmspszc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlcW95a29ldnlnZ2VtbXNwc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzAyNTksImV4cCI6MjA5NDUwNjI1OX0.70dkxT--W5zbc4vWYcusrhzpivmSLbuP3GQNqxKNlLw";

// Assign to global supabase
supabase = supabase.createClient(supabaseUrl, supabaseKey);

let CURRENT_USER_ID = null;

// Login button handler
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = prompt("Enter your email:");
  const password = prompt("Enter your password:");
  if (!email || !password) return;

  // Sign in with Supabase Auth
  const { data: signInData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) return alert("Login failed: " + loginError.message);

  CURRENT_USER_ID = signInData.user.id;

  // Get user row
  const { data: user } = await supabase.from("users").select("*").eq("id", CURRENT_USER_ID).single();
  document.getElementById("user-name").textContent = `Logged in as ${user.data.display_name}`;

  // Load UI
  loadMatches();
  loadLeaderboard();
  subscribeRealtime();
});

// Load upcoming matches with batch predictions
async function loadMatches() {
  if (!CURRENT_USER_ID) return;

  // Fetch all matches
  const { data: matches, error: matchesError } = await supabase.from("matches")
    .select("*")
    .order("match_date", { ascending: true });
  if (matchesError) return console.error(matchesError);

  // Fetch all predictions for current user in one query
  const matchIds = matches.map(m => m.id);
  const { data: predictions } = await supabase.from("predictions")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .in("match_id", matchIds);

  const predictionsMap = {};
  if (predictions) predictions.forEach(p => { predictionsMap[p.match_id] = p; });

  const tbody = document.querySelector("#matches-table tbody");
  tbody.innerHTML = "";

  for (let match of matches) {
    const pred = predictionsMap[match.id];
    const homeVal = pred ? pred.predicted_home : "";
    const awayVal = pred ? pred.predicted_away : "";

    const row = document.createElement("tr");
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
      <td>
        <button class="submit-btn" onclick="submitPrediction('${match.id}', ${match.is_locked})" ${match.is_locked ? "disabled" : ""}>Submit</button>
      </td>
    `;
    tbody.appendChild(row);
  }
}

// Submit or update prediction
async function submitPrediction(matchId, isLocked) {
  if (isLocked) return alert("Predictions are locked.");

  const homeScore = parseInt(document.getElementById(`home-${matchId}`).value);
  const awayScore = parseInt(document.getElementById(`away-${matchId}`).value);
  if (isNaN(homeScore) || isNaN(awayScore)) return alert("Enter both scores.");

  const { data: existing } = await supabase.from("predictions")
    .select("*")
    .eq("user_id", CURRENT_USER_ID)
    .eq("match_id", matchId)
    .single();

  if (existing) {
    await supabase.from("predictions")
      .update({ predicted_home: homeScore, predicted_away: awayScore })
      .eq("id", existing.id);
  } else {
    await supabase.from("predictions")
      .insert([{ user_id: CURRENT_USER_ID, match_id: matchId, predicted_home: homeScore, predicted_away: awayScore }]);
  }

  loadMatches();
  loadLeaderboard();
}

// Load leaderboard
async function loadLeaderboard() {
  const { data: leaderboard } = await supabase.from("users")
    .select("*")
    .order("total_points", { ascending: false });

  const tbody = document.querySelector("#leaderboard-table tbody");
  tbody.innerHTML = "";

  leaderboard.forEach((user, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i + 1}</td><td>${user.display_name}</td><td>${user.total_points}</td>`;
    tbody.appendChild(row);
  });
}

// Subscribe to realtime updates
function subscribeRealtime() {
  supabase.from('users').on('UPDATE', payload => loadLeaderboard()).subscribe();
  supabase.from('matches').on('UPDATE', payload => loadMatches()).subscribe();
}

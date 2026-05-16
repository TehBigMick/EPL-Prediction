// Supabase setup
const supabaseUrl = "https://reqoykoevyggemmspszc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlcW95a29ldnlnZ2VtbXNwc3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzAyNTksImV4cCI6MjA5NDUwNjI1OX0.70dkxT--W5zbc4vWYcusrhzpivmSLbuP3GQNqxKNlLw"; // <-- Replace with your anon key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let CURRENT_USER_ID = null;

// Login / Sign Up
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = prompt("Enter your email:");
  const password = prompt("Enter your password:");
  if (!email || !password) return;

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Try sign up if login fails
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) return alert(signUpError.message);
    CURRENT_USER_ID = signUpData.user.id;
  } else {
    CURRENT_USER_ID = signInData.user.id;
  }

  const { data: user } = await supabase.from("users").select("*").eq("id", CURRENT_USER_ID).single();
  document.getElementById("user-name").textContent = `Logged in as ${user.display_name}`;

  loadMatches();
  loadLeaderboard();
  subscribeRealtime();
});

// Load upcoming matches
async function loadMatches() {
  if (!CURRENT_USER_ID) return;

  // Six weekend matches
  const matchesList = [
    { home: 'Man United', away: 'Notts Forest', date: '2026-05-16 15:00:00' },
    { home: 'Brentford', away: 'Palace', date: '2026-05-16 15:00:00' },
    { home: 'Everton', away: 'Sunderland', date: '2026-05-16 15:00:00' },
    { home: 'Leeds', away: 'Brighton', date: '2026-05-16 15:00:00' },
    { home: 'Wolves', away: 'Fulham', date: '2026-05-16 15:00:00' },
    { home: 'Newcastle', away: 'West Ham', date: '2026-05-16 15:00:00' },
  ];

  const tbody = document.querySelector("#matches-table tbody");
  tbody.innerHTML = "";

  for (let match of matchesList) {
    // Try to get match from Supabase
    const { data: dbMatch } = await supabase.from("matches")
      .select("*")
      .eq("home_team", match.home)
      .eq("away_team", match.away)
      .single();

    const isLocked = dbMatch?.is_locked ?? false;
    const homeScore = dbMatch?.home_score ?? "-";
    const awayScore = dbMatch?.away_score ?? "-";
    const matchId = dbMatch?.id ?? null;

    // Get prediction for current user
    let homeVal = "", awayVal = "";
    if (matchId) {
      const { data: pred } = await supabase.from("predictions")
        .select("*")
        .eq("user_id", CURRENT_USER_ID)
        .eq("match_id", matchId)
        .single();
      if (pred) {
        homeVal = pred.predicted_home;
        awayVal = pred.predicted_away;
      }
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${match.home}</td>
      <td>${match.away}</td>
      <td>${new Date(match.date).toLocaleString()}</td>
      <td>
        <input type="number" id="home-${matchId}" value="${homeVal}" ${isLocked ? "disabled" : ""}>
        -
        <input type="number" id="away-${matchId}" value="${awayVal}" ${isLocked ? "disabled" : ""}>
      </td>
      <td>${homeScore} - ${awayScore}</td>
      <td>
        <button onclick="submitPrediction('${matchId}', ${isLocked})" ${isLocked ? "disabled" : ""}>Submit</button>
      </td>
    `;
    tbody.appendChild(row);
  }
}

// Submit prediction
async function submitPrediction(matchId, isLocked) {
  if (!matchId) return alert("Match not yet in database.");
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
    row.innerHTML = `<td>${i+1}</td><td>${user.display_name}</td><td>${user.total_points}</td>`;
    tbody.appendChild(row);
  });
}

// Subscribe to live updates
function subscribeRealtime() {
  supabase.from('users').on('UPDATE', payload => loadLeaderboard()).subscribe();
  supabase.from('matches').on('UPDATE', payload => loadMatches()).subscribe();
}

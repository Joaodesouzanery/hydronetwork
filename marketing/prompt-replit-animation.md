# Prompt para Replit Animation - Apresentacao HydroNetwork

---

## PROMPT COMPLETO (copie e cole no Replit)

---

Create a sleek, modern animated presentation/landing page for "HydroNetwork" — a web platform for sanitation infrastructure engineering. The animation should feel like a premium SaaS product video, using dark theme with blue (#3B82F6) and cyan (#06B6D4) accent colors on a dark navy/slate background (#0F172A).

### SCENE 1: Opening (3 seconds)
- Black screen fades in
- The text "HydroNetwork" appears with a subtle glow effect, letter by letter
- Below it, the tagline fades in: "Do levantamento topográfico ao Relatório Diário de Obra"
- Small particles float in the background like water molecules
- A thin blue line draws itself horizontally under the title

### SCENE 2: The Problem (5 seconds)
- Five software icons appear in a row (generic app icons or rectangles), each labeled:
  "CAD" | "Simulação" | "Orçamento" | "Planejamento" | "RDO"
- Red dotted lines appear between them, showing disconnection
- Text appears: "5 softwares. Nenhum conversa entre si."
- The icons shake slightly, then scatter/dissolve

### SCENE 3: The Network Animation - Hero Scene (10 seconds)
This is the main visual. Animate a top-down view of a sanitation network being built:

**Phase 1 - Topography points appear:**
- Small dots (survey points) appear one by one on a dark map grid
- Each dot has a subtle pulse effect when it appears
- Coordinate labels briefly flash (like "E: 325,400 / N: 7,394,200")

**Phase 2 - Pipes connect the points:**
- Animated blue lines (water pipes) draw themselves between points, creating a network
- The lines have a flowing water animation inside them (subtle gradient movement)
- At junction points, small circles appear (manholes/nodes)
- Color coding: Blue pipes = water, Brown/orange pipes = sewage, Green pipes = drainage

**Phase 3 - Data overlays appear:**
- Small floating labels appear next to pipe segments showing:
  "DN 300mm | V: 1.2 m/s | i: 0.5%"
- A mini profile view (longitudinal section) slides in from the bottom showing pipe depth vs terrain
- Depth indicators appear: "Prof: 1.5m", "Prof: 2.8m", "Prof: 4.2m" with color gradient (green to yellow to red for deeper)

**Phase 4 - Cost map overlay:**
- The pipe segments smoothly change color based on cost:
  - Green segments: "< R$ 20k"
  - Yellow segments: "R$ 20k - 50k"
  - Red segments: "> R$ 50k"
- A floating total appears: "Custo Total: R$ 847.320,00"
- The total number counts up from 0 with an odometer effect

### SCENE 4: Dashboard Morphing (5 seconds)
The network map smoothly transitions/morphs into a dashboard view showing:
- A Gantt chart with colored bars appearing one by one (blue, green, orange)
- An S-Curve drawing itself (planned line in gray, executed line in blue catching up)
- A small pie chart filling up showing "72% executado"
- KPI cards sliding in: "Equipes: 4" | "Prazo: 180 dias" | "Avanço: 72%"

### SCENE 5: Field Tracking / RDO (4 seconds)
- A phone mockup appears on the right side
- Inside the phone, a simplified RDO form animates:
  - A segment turns from red to green (showing completion)
  - A checkmark appears with a pulse effect
  - Text: "Trecho 15 → 100% executado"
- On the left, the network map updates in real-time — the same segment turns green
- Text: "Campo e escritório sincronizados em tempo real"

### SCENE 6: Export Ecosystem (3 seconds)
- File format icons fly out from the center in a radial pattern:
  "PDF" | "DXF" | "SHP" | "KML" | "CSV" | "INP" | "GeoJSON" | "Excel"
- Each icon has a subtle bounce when it lands in position
- Below: logos/icons of compatible tools appear in a row:
  "QGIS" | "EPANET" | "AutoCAD" | "Google Earth" | "MS Project"

### SCENE 7: Closing (3 seconds)
- Everything fades to the dark background
- "HydroNetwork" logo appears centered, larger
- Tagline: "Uma plataforma. Todo o ciclo."
- A subtle call-to-action: "Acesse agora — 100% no navegador"
- The flowing water particle effect continues in the background

---

### VISUAL STYLE GUIDELINES:

**Colors:**
- Background: #0F172A (dark navy) to #1E293B (dark slate) gradient
- Primary accent: #3B82F6 (blue) — water pipes, main elements
- Secondary accent: #06B6D4 (cyan) — highlights, glows
- Sewage pipes: #F97316 (orange)
- Drainage pipes: #22C55E (green)
- Cost red: #EF4444
- Cost yellow: #EAB308
- Cost green: #22C55E
- Text: #F8FAFC (near-white)
- Muted text: #94A3B8 (slate gray)

**Typography:**
- Main title: Bold, sans-serif (Inter or similar), large
- Body text: Regular weight, clean
- Data labels: Monospace font for numbers/coordinates
- All text in Portuguese (Brazilian)

**Animation style:**
- Smooth, fluid transitions (ease-in-out)
- No jarring cuts — everything flows like water
- Subtle particle effects in background (floating dots like water molecules)
- Glow effects on interactive elements
- Lines draw themselves rather than appearing instantly
- Numbers count up with odometer/ticker effect
- Elements have slight parallax on scroll if interactive

**Mood:**
- Professional but modern (not corporate boring)
- Engineering precision meets design elegance
- The feeling of water flowing through a well-designed system
- Dark theme conveys sophistication and seriousness
- Blue accents convey trust and technology

---

### TECHNICAL NOTES FOR REPLIT:

- Use HTML Canvas or SVG for the network animation
- CSS animations for UI element transitions
- requestAnimationFrame for smooth pipe-drawing effects
- Consider using a simple particle system for background
- Total duration: ~33 seconds if auto-playing, or make it scroll-driven
- Make it responsive (works on mobile)
- Add subtle background music option (ambient/electronic, very low volume)
- Export as: embeddable web page + screen recording capability

---

### ALTERNATIVE: SHORTER VERSION (15 seconds for social media)

If making a shorter version for X/LinkedIn video:
1. (0-2s) "HydroNetwork" title with glow
2. (2-7s) Network pipes drawing themselves with flowing water effect + cost colors
3. (7-10s) Quick flash of Gantt + S-Curve + RDO phone
4. (10-13s) Export icons radiating out
5. (13-15s) "Uma plataforma. Todo o ciclo." + logo

This shorter version is ideal for social media posts.

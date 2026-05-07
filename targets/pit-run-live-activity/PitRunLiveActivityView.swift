import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Helpers

private extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

private func formatElapsed(_ ms: Int) -> String {
    let totalSec = ms / 1000
    let m = totalSec / 60
    let s = totalSec % 60
    return String(format: "%d:%02d", m, s)
}

private func formatPace(_ secPerKm: Int) -> String {
    guard secPerKm > 0 else { return "--'--\"" }
    let m = secPerKm / 60
    let s = secPerKm % 60
    return String(format: "%d'%02d\"", m, s)
}

private func sectorColor(_ sector: String) -> Color {
    switch sector {
    case "purple": return Color(hex: "#9B59B6")
    case "green":  return Color(hex: "#2ECC71")
    default:       return Color(hex: "#F1C40F") // yellow
    }
}

private func tireLabel(_ tire: String) -> String {
    switch tire {
    case "medium": return "M"
    case "hard":   return "H"
    default:       return "S"
    }
}

private func tireColor(_ tire: String) -> Color {
    switch tire {
    case "medium": return Color(hex: "#F5C518")
    case "hard":   return .white
    default:       return Color(hex: "#E8002D")
    }
}

// MARK: - Live Activity View

struct PitRunLiveActivityView: View {
    let context: ActivityViewContext<PitRunAttributes>

    var body: some View {
        let state = context.state
        let teamClr = Color(hex: context.attributes.teamColor)

        HStack(spacing: 16) {
            // Team color indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(teamClr)
                .frame(width: 4)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.driverName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Text(String(format: "%.2f km", state.distKm))
                    .font(.system(.title2, design: .monospaced, weight: .bold))
                    .foregroundStyle(.white)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(sectorColor(state.sector))
                        .frame(width: 8, height: 8)
                    Text(formatPace(state.paceS))
                        .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                        .foregroundStyle(.white)
                }

                HStack(spacing: 6) {
                    Text(formatElapsed(state.elapsedMs))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Text(tireLabel(state.tire))
                        .font(.system(.caption2, design: .monospaced, weight: .bold))
                        .foregroundStyle(tireColor(state.tire))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
        .padding()
        .background(Color(hex: "#17171C"))
    }
}

// MARK: - Widget Configuration

struct PitRunLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PitRunAttributes.self) { context in
            PitRunLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading) {
                        Text(context.attributes.driverName)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(String(format: "%.2f", context.state.distKm))
                            .font(.system(.title3, design: .monospaced, weight: .bold))
                            .foregroundStyle(.white)
                        Text("km")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing) {
                        Text(formatPace(context.state.paceS))
                            .font(.system(.title3, design: .monospaced, weight: .bold))
                            .foregroundStyle(.white)
                        Text("pace")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(formatElapsed(context.state.elapsedMs))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Circle()
                            .fill(sectorColor(context.state.sector))
                            .frame(width: 8, height: 8)
                        Text("섹터")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(tireLabel(context.state.tire))
                            .font(.system(.caption, design: .monospaced, weight: .bold))
                            .foregroundStyle(tireColor(context.state.tire))
                    }
                    .padding(.horizontal, 8)
                }
            } compactLeading: {
                Text(String(format: "%.1f", context.state.distKm))
                    .font(.system(.caption, design: .monospaced, weight: .bold))
                    .foregroundStyle(.white)
            } compactTrailing: {
                Text(formatPace(context.state.paceS))
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(.white)
            } minimal: {
                Circle()
                    .fill(sectorColor(context.state.sector))
                    .frame(width: 12, height: 12)
            }
        }
    }
}

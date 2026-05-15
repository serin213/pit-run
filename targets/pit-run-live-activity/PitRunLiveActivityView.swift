import ActivityKit
import SwiftUI
import WidgetKit

// MARK: - Color Helper
private extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Formatters
private func formatPace(_ s: Int) -> String {
    guard s > 0 else { return "--'--\"" }
    return String(format: "%d'%02d\"", s / 60, s % 60)
}

// MARK: - Circuit Path Data
private struct CircuitInfo {
    let pathData: String
    let vw: CGFloat
    let vh: CGFloat
    let name: String
    let flagImageName: String
    /// Normalized [0,1] offset along the path where the runner starts.
    /// Matches `getAnchorLengths` in src/components/CircuitMap.tsx.
    /// Computed via .tmp/compute_startlen.mjs using svg-path-properties.
    let startFrac: CGFloat
}

private let SHANGHAI_PATH =
    "M103.184 98.296L104.912 93.580L132.665 17.5331C133.833 14.3174 135.554 11.2902 137.891 8.80303C142.036 4.39403 149.259 -0.0149686 160.124 4.20561C160.124 4.20561 172.283 8.68998 168.641 20.6106C168.641 20.6106 165.664 28.9136 159.546 27.9715C158.077 27.7454 156.758 26.9415 155.715 25.8863C154.76 24.9066 153.517 23.4118 152.6 21.4397C151.758 19.6434 150.075 18.94 148.555 18.6887C146.382 18.337 144.108 18.8395 142.488 20.3217C141.106 21.5778 139.926 23.7258 140.767 27.2681C142.463 34.3401 148.517 38.2717 148.517 38.2717C148.517 38.2717 151.947 41.1357 156.707 40.784C161.468 40.4323 215.695 32.7699 215.695 32.7699C215.695 32.7699 219.438 31.9409 224.011 33.2221C228.583 34.5034 263.754 43.0827 263.754 43.0827C263.754 43.0827 270.864 45.2684 265.94 50.5818C261.016 55.8952 250.276 56.7117 250.276 56.7117C250.276 56.7117 226.962 57.4528 206.94 54.8526C186.917 52.2399 178.828 67.8912 178.828 67.8912C178.828 67.8912 171.442 78.5557 179.87 95.2998C180.988 97.5106 182.37 99.5832 183.865 101.568C187.294 106.14 195.296 118.902 186.993 129.265C183.099 134.127 176.868 136.438 170.663 135.973C167.711 135.747 163.855 135.22 158.868 134.152C157.335 133.825 155.728 133.75 154.208 134.114C150.992 134.88 146.998 137.594 150.464 146.751L153.542 155.267C153.542 155.267 154.484 159.061 159.936 159.174C165.387 159.287 253.203 161.661 253.203 161.661C253.203 161.661 258.202 161.711 256.532 155.531C254.861 149.351 251.608 143.698 260.539 141.563C263.641 140.822 266.907 140.897 269.972 141.739C276.554 143.548 286.754 149.15 281.026 166.359C281.026 166.359 275.06 181.118 258.918 181.269C242.777 181.42 4.41473 182.5 4.41473 182.5C4.41473 182.5 0.483053 182.01 3.88715 177.702C5.20608 176.018 7.44199 174.7 9.67789 173.695C13.1448 172.15 16.9006 171.371 20.6941 171.22L75.2602 169.047C75.2602 169.047 77.7724 168.494 78.3754 166.359L78.3628 166.309L103.184 98.296"

private let LAS_VEGAS_PATH =
    "M15.4051 88.2456C8.65372 90.0524 7.75638 95.8855 7.75638 95.8855L2.61447 113.854C2.15867 115.419 3.11299 117.069 4.70826 117.439C8.51128 118.307 15.5618 120.697 23.7518 127.256C36.044 137.101 34.876 134.113 60.785 148.966C86.7082 163.833 106.991 164.502 106.991 164.502H274.096C276.261 164.502 278.013 162.724 277.97 160.561L277.942 159.096C277.899 157.161 278.668 155.297 280.05 153.946L286.602 147.543C287.599 146.562 288.183 145.224 288.197 143.816C288.396 129.532 288.781 48.9935 288.168 45.1949C287.456 40.8415 285.305 38.2238 284.024 36.5165C283.796 36.2035 283.539 35.919 283.326 35.5917C278.981 29.2465 263.114 10.6946 259.069 6.68264C258.456 6.07088 257.573 5.8291 257.075 5.78642C255.95 5.78642 254.853 6.1136 253.899 6.72536C252.403 7.69279 251.263 9.17239 250.793 10.9081C250.423 12.2739 250.167 13.9384 250.608 15.4749C251.15 17.3529 255.123 24.509 257.36 28.1796C258.926 30.7404 259.696 33.7281 259.354 36.7015C258.163 47.1443 245.941 48.0872 243.273 48.2931L243.23 48.2964L108.843 50.6154C104.57 50.7861 104.74 46.3331 104.74 46.3331C106.265 16.9261 98.8009 10.652 97.2911 9.07284C90.7533 2.25814 81.609 2.40037 77.1935 2.54264C74.2024 2.64223 73.1768 5.85754 73.1768 5.85754C71.7382 9.55654 68.8183 9.85527 66.5109 9.38579C64.8301 9.04434 63.3203 8.19073 62.0242 7.08103C61.312 6.45505 60.2865 5.62992 59.0615 4.80476C58.7482 4.59136 58.4633 4.42063 58.1927 4.26413C56.9677 3.58124 55.4294 3.86575 54.5178 4.94699C54.062 5.47339 53.9338 6.01404 53.8057 6.8392C52.951 12.3735 53.3641 38.5083 53.5778 49.7618C53.8199 62.3953 50.9 67.0191 50.9 67.0191C44.3337 79.6668 21.8859 86.5099 15.4051 88.2456Z"

private let SUZUKA_PATH =
    "M134.76 95.4323C134.225 92.4586 128.673 61.3449 127.297 53.6914C127.127 52.7651 127.297 53.1673 126.677 50.9371C126.64 50.7908 126.616 50.7177 126.579 50.6202C124.656 44.5876 132.204 32.4126 133.348 29.9021C133.348 29.9021 134.87 26.6481 132.386 24.9907C127.152 21.0298 120.444 35.9469 117.352 41.7236C116.512 43.2958 116.427 43.4542 115.965 44.417C108.977 58.9806 61.0521 68.389 41.5267 32.4492C41.5267 32.4492 38.1917 25.9291 31.5209 9.37894C31.5209 9.37894 29.0261 2.70038 16.9383 2.50538C16.9383 2.50538 7.22399 2.06666 3.51124 9.11083C2.91477 10.232 2.57354 11.4995 2.51268 12.7792C1.11279 42.7839 116.05 77.8828 136.331 85.4023C137.292 85.7557 138.278 85.9751 139.288 86.0482C143.634 86.3407 154.066 85.6826 165.923 75.287C184.949 58.7368 185.582 55.8485 194.066 50.5227C194.359 50.3399 195.332 49.7915 195.649 49.6574C200.481 47.744 203.257 58.2494 207.798 53.0942C215.589 44.2463 225.801 43.6004 238.315 51.4855L238.34 51.4733C243.294 54.5932 247.616 58.6028 251.316 63.1486L322.15 150.177C322.15 150.177 330.002 157.989 321.664 172.906C321.384 173.418 321.054 173.917 320.677 174.356C308.808 188.237 291.876 151.761 290.927 149.945C284.536 138.721 266.593 156.392 263.148 126.79C262.637 122.402 257.475 114.261 245.423 115.334C244.864 115.383 244.304 115.395 243.744 115.37C233.871 115.054 224.243 107.254 233.617 87.3401C234.031 86.4748 234.347 85.5485 234.493 84.5979C234.943 81.7462 234.834 76.8469 230.172 72.8983C229.794 72.5814 229.125 72.1305 228.699 71.8746C198.79 54.1423 183.987 70.1562 164.34 95.8588C161.127 100.076 141.005 98.8569 139.07 98.8813C139.07 98.8813 135.405 99.0275 134.76 95.4323Z"

private let MONACO_PATH =
    "M303.698 87.507C303.698 87.507 285.8 100.022 266.518 104.632C247.237 109.231 227.006 97.1105 215.786 93.8472C204.566 90.5839 180.94 78.5769 167.202 65.5339C167.202 65.5339 164.807 62.9025 162.701 65.6064L162.666 65.6512C160.587 68.3104 159.873 69.2241 156.26 65.8965C152.626 62.5503 154.619 62.6021 153.742 60.1986C152.864 57.7848 103.742 20.3031 103.742 20.3031C103.742 20.3031 101.637 18.0343 97.787 19.35C93.9369 20.6657 74.6555 24.0326 63.3427 41.7582C63.3427 41.7582 61.3713 44.5657 63.3427 49.756C65.3245 54.9462 48.5827 75.6554 48.5827 75.6554L45.7855 79.157C45.4552 79.5611 45.1448 79.9858 44.8249 80.4106C44.381 81.0011 43.4622 82.1303 41.821 83.6946C41.3772 84.1194 40.5205 84.8031 38.7245 84.1712L34.9263 82.4618C33.6464 81.7884 32.6664 82.669 32.6664 82.669C31.8303 83.2388 30.0134 86.9269 30.0134 86.9269C28.2483 90.646 21.4569 103.399 20.7963 110.858C20.1769 117.82 21.0028 123.321 23.7174 129.267C24.3883 130.738 24.5941 132.437 24.0057 133.95C23.7477 134.623 23.3251 135.701 22.6026 136.188C20.1253 137.866 9.40018 132.634 3.02126 124.036C3.02126 124.036 1.52515 121.529 3.59985 119.28C5.67455 117.032 7.19118 118.317 7.80017 113.034C8.61685 105.951 15.4202 82.0264 32.8892 56.2806C37.1661 49.8257 49.0978 34.0242 62.6099 22.4579C67.0483 18.5419 71.8991 15.1129 77.0807 12.2536C78.1026 11.6838 79.1762 11.114 80.3426 10.5546C84.2236 8.67944 87.8876 6.37957 91.1906 3.60315L91.8307 3.06443C91.8307 3.06443 93.4516 1.55191 95.8153 3.47883L96.404 3.94502C109.379 14.139 122.941 23.5457 136.948 32.2376C145.401 37.4796 155.011 43.8198 161.669 49.3519C161.669 49.3519 164.353 51.2581 173.952 54.4697C183.551 57.6812 186.834 59.4216 189.776 61.504C192.707 63.5863 207.24 74.7852 207.24 74.7852C207.24 74.7852 219.44 85.5594 234.645 75.9351C234.645 75.9351 238.918 73.3245 241.643 66.1762C242.892 62.9232 243.407 59.4424 243.397 55.9615C243.387 53.6512 243.325 50.6469 243.109 48.3263C242.696 43.9234 246.257 41.406 249.56 40.1421C249.56 40.1421 256.702 37.1792 265.011 36.827C273.321 36.4747 304.307 31.8335 304.307 31.8335C304.307 31.8335 307.95 30.9633 309.705 32.5484C309.705 32.5484 313.111 35.1176 311.903 39.8209C311.903 39.8209 311.522 42.5456 307.713 45.6017C304.792 47.943 304.648 54.2003 304.648 54.2003C304.648 54.2003 304.565 58.5514 301.819 63.8763C301.819 63.8763 300.498 67.2744 304.595 68.0721C304.595 68.0721 308.559 68.559 308.167 62.8507C307.775 57.1529 309.457 50.9888 309.457 50.9888C309.457 50.9888 309.809 47.6944 313.38 47.1246C314.701 46.907 316.043 47.2075 317.23 47.798L328.253 53.3094C328.253 53.3094 330.442 54.4904 333.374 57.3393C334.127 58.0749 334.58 59.1108 334.488 60.1572C334.436 60.7891 334.199 61.4625 333.6 62.053C331.918 63.7002 303.698 87.507 303.698 87.507Z"

private let HUNGARORING_PATH =
    "M228.397 128.996C227.241 132.152 227.872 135.668 229.748 138.447C232.915 143.12 239.578 153.398 240.389 158.191C240.824 160.715 240.179 162.954 239.248 164.742C238.063 167.041 236.141 168.874 233.904 170.151C227.916 173.577 209.651 184.034 203.678 187.881C196.489 192.523 194.793 198.473 194.793 198.473C194.793 198.473 189.15 216.714 185.293 226.451C182.967 232.295 178.314 234.775 174.967 235.826C173.076 236.412 171.08 236.593 169.099 236.457C156.672 235.631 89.4191 231.153 80.2489 230.943C70.1333 230.703 74.2163 220.621 74.2163 220.621C76.5426 213.995 77.7884 184.966 78.0886 177.138C78.1786 174.929 77.6223 172.72 76.3166 170.947C74.8007 168.874 72.0846 166.89 67.2969 167.296C57.7216 168.092 58.0075 177.979 58.0075 177.979L57.9768 209.983C57.9768 209.983 58.6373 216.789 52.9041 222.033C47.1859 227.277 41.6933 226.375 41.6933 226.375C26.5648 225.068 27.0454 210.434 27.0454 210.434V160.5V9.6656L27 9.6806C27 9.6806 26.9851 3.73058 31.9378 2.67881C34.144 2.21302 35.9448 2.7239 37.2655 3.44511C38.5862 4.16632 39.6366 5.27821 40.402 6.55536C41.5727 8.49362 44.1698 12.1748 48.5672 18.245C50.7734 21.2952 52.5746 24.9764 54.0004 28.6576C57.2272 36.9515 58.7272 45.8164 58.7272 54.7114L58.7726 91.2529C58.7876 93.5518 58.6372 95.8507 58.4721 98.1496C57.4066 113.355 68.062 116.21 68.062 116.21C77.4572 120.026 83.1759 109.298 83.1759 109.298C83.1759 109.298 89.4639 95.9108 91.6401 87.4065C93.6062 79.6985 101.532 78.5416 101.532 78.5416C101.532 78.5416 159.628 66.8819 175.672 62.9753C191.656 59.0688 207.76 61.2324 212.202 61.0221C216.33 60.8267 218.912 57.1155 218.912 57.1155C218.912 57.1155 237.627 31.9782 241.064 26.9747C241.56 26.2685 242.085 25.6224 242.625 25.0365C246.437 20.9195 252.141 18.9062 257.694 19.6574C266.038 20.7693 269.581 27.8011 270.001 31.888C270.541 37.1018 271.307 45.2755 270.871 51.2556C270.436 57.2507 266.773 75.3111 265.963 85.1677C265.197 94.4233 262.466 95.43 262.466 95.43C262.466 95.43 261.146 96.1512 256.628 95.6253C252.486 95.1595 251.57 96.9175 251.57 96.9175C251.57 96.9175 232.795 122.551 229.688 126.623C229.117 127.374 228.697 128.185 228.397 128.996Z"

private let MARINA_BAY_PATH =
    "M8.21725 138.541L15.37 144.09C16.6726 145.101 18.2402 145.715 19.9046 145.86H19.9764C21.9182 146.016 23.3659 147.738 23.173 149.675C21.9548 162.11 25.947 165.649 29.5531 167.924C31.1692 168.947 33.1596 169.79 34.7637 170.837C41.9278 175.519 47.8124 183.175 51.2859 188.411C52.5161 190.265 55.3629 189.639 55.6885 187.448C57.582 174.713 61.8753 146.763 65.3006 132.077C68.9188 116.597 78.7728 95.3639 82.6201 87.4074C83.4161 85.7703 85.5148 85.2888 86.9379 86.4323L110.818 105.62C113.302 107.762 114.375 108.737 116.112 110.386C116.45 110.699 117.716 111.771 118.066 112.047C123.964 116.718 127.655 117.332 133.71 117.572C159.664 118.632 206.472 121.749 221.801 122.785C224.635 122.977 226.817 125.324 226.817 128.406V129.537C226.817 135.749 231.763 140.828 237.986 140.973C252.664 141.322 273.951 142.634 284.275 143.308C288.014 143.549 291.559 141.695 293.501 138.505L300.315 127.286C301.268 125.71 301.666 123.844 301.437 122.014C300.754 116.648 299.988 110.727 299.173 104.5C294.921 72.0082 289.349 31.1783 287.447 17.279L287.422 17.291C287.048 14.5225 284.625 12.4882 281.815 12.5845L278.703 12.6928C275.917 12.8012 273.191 11.8743 271.057 10.0928L269.79 9.04557C267.8 7.38445 265.87 5.66314 264 3.85757C261.082 1.02884 256.173 2.90664 255.896 6.96315L254.955 20.6614C254.702 24.2846 255.232 27.9198 256.511 31.3263L261.082 43.532C264.712 53.2219 266.956 63.3812 267.728 73.7091C268.09 78.4397 265.002 82.7971 260.395 83.9166C260.335 83.9286 260.286 83.9407 260.225 83.9527C258.139 84.4342 255.993 84.5907 253.858 84.5064C232.258 83.6759 196.762 80.9675 179.817 79.6314C172.581 79.0536 165.525 77.0554 159.072 73.7211C142.911 65.3553 120.31 50.983 109.89 44.2301C106.537 42.0635 102.086 42.894 99.7218 46.1079C98.2745 48.058 96.8033 50.1885 95.3922 52.271C91.5328 57.9886 88.1439 64.0072 85.0323 70.1581C82.994 74.1786 81.3773 76.0925 80.2315 77.0073C79.3632 77.7054 78.0978 77.549 77.3742 76.7064C66.3628 63.8748 59.6813 58.2173 55.1585 54.7747C52.3725 52.6561 48.5001 52.7284 45.7985 54.9913L45.6784 55.0876C42.4823 57.7719 39.8647 61.0701 38.0074 64.8137C31.2896 78.3434 17.4923 103.104 11.3655 114.021C9.35137 117.609 6.98706 120.979 4.29752 124.097C2.47636 126.215 1.99478 129.164 3.05612 131.752C4.15364 134.424 5.92572 136.772 8.21725 138.541Z"

private let MONZA_PATH =
    "M68.5737 36.6478C73.4722 43.9626 79.1689 50.6909 85.5636 56.7441L138.218 106.598C139.592 107.903 141.531 108.446 143.382 108.025C146.308 107.361 150.841 106.642 153.955 107.627C156.948 108.567 159.862 111.279 161.68 113.259C162.987 114.698 164.816 115.539 166.756 115.572C186.106 115.937 287.092 117.874 293.609 118.56C293.908 118.593 294.207 118.638 294.484 118.682C299.305 119.523 302.619 123.983 302.497 128.863C302.364 133.964 300.535 143.349 289.43 147.631C276.738 152.509 254.499 153.343 245.5 153.476C243.026 153.512 241.553 153.496 241.553 153.496L117.471 152.401L117.448 152.412C115.132 152.323 115.365 149.313 115.365 149.313C115.875 144.455 110.422 147.388 110.422 147.388C99.3724 153.341 72.164 156.938 53.9106 147.011C35.6463 137.096 32.4551 114.842 32.4551 114.842C32.4551 114.842 24.4198 66.6484 24.3866 62.9633C24.3644 59.2783 20.5963 60.1082 19.211 59.6324C18.2468 59.3115 17.77 57.8286 17.5594 56.9322C17.371 56.1244 17.2053 55.3055 16.9836 54.4977C13.7031 42.3026 6.58756 27.662 3.7947 22.1399C2.86375 20.3029 2.36542 18.2557 2.53166 16.1974C3.04146 9.87854 8.43886 8.49526 8.43886 8.49526L38.3179 2.68548C42.3299 1.91084 46.4079 3.60398 48.6799 6.99025L68.5737 36.6478Z"

private let BAKU_PATH =
    "M23.4568 15.9155C19.3012 19.8454 12.5497 25.8083 5.47955 30.2493C3.95394 31.2034 1.8705 31.8849 2.67885 35.2241C4.72818 41.5278 8.57694 70.8202 9.5333 77.5328C9.5333 77.5328 9.84074 82.5871 13.5637 82.1214C15.3512 81.8942 25.631 80.0088 32.7695 78.5891C36.4583 77.8621 40.2499 77.794 43.9501 78.4187L69.0664 82.6211C71.4004 83.0073 73.7903 82.837 76.0332 82.11L87.9998 78.237C91.0624 77.2488 94.3414 77.1693 97.4382 78.0325L130.158 87.0394C140.758 89.9584 150.914 94.2631 160.375 99.8399L243.738 149.02L250.5 152.774L288.914 174.099C290.678 175.03 292.068 174.155 292.694 173.349L293.172 172.69C300.959 161.593 308.154 149.293 314.109 137.117L313.904 137.537C315.088 135.538 314.45 132.971 312.458 131.767C296.712 122.227 233.434 83.9955 213.726 74.1367C211.677 73.1145 209.183 73.7732 207.897 75.67C204.64 80.4631 199.016 89.8903 194.849 96.3643C193.904 97.8409 191.764 98.7041 190.034 97.7727C185.73 95.433 177.851 91.2192 171.498 88.1752C165.237 85.1767 157.505 82.6211 153.168 81.2809C150.139 80.3495 147.567 81.5989 146.406 85.029C146.406 85.0631 146.143 85.7787 146.132 85.8127C145.586 87.7095 143.503 87.3574 142.307 87.0508C141.875 86.9372 140.565 86.5056 140.178 86.392L103.381 76.0108C99.749 74.9885 97.4947 74.6705 94.1816 74.273C93.0545 74.1367 92.1213 73.353 91.7912 72.274L91.7222 72.0241C91.4831 71.2404 91.6201 70.3885 92.0869 69.7071C98.1894 60.8024 99.8061 58.4967 106.034 49.2172C106.614 48.3653 106.546 47.2182 105.875 46.4345C105.362 45.8325 105.077 45.0829 105.043 44.2992C104.998 42.834 104.451 41.4256 103.518 40.3011L102.31 38.8587C100.955 37.2345 100.808 34.9288 101.947 33.157L103.757 30.3288C104.645 28.9318 104.269 27.0918 102.892 26.1718C95.8557 21.4582 75.2711 8.10115 61.1535 3.433C58.5918 2.59251 55.8702 2.25178 53.2061 2.69474C52.6596 2.7856 52.1018 2.89919 51.5439 3.0582C49.5174 3.6261 40.2047 7.26066 33.7835 9.5777C29.9467 10.9634 26.4283 13.1101 23.4568 15.9155Z"

private let ALBERT_PARK_PATH =
    "M244.834 151.514L121.558 154.5C120.369 154.38 119.463 153.417 119.267 152.247C118.645 148.419 114.882 134.836 93.34 137.997C68.3401 141.661 20.598 130.877 18.0784 128.81C15.5588 126.743 17.3477 123.375 17.3477 123.375C17.3477 123.375 24.4266 112.778 26.3463 110.175C28.2661 107.583 25.5059 105.144 25.5059 105.144C25.5059 105.144 5.46882 87.2631 3.91996 85.3164C2.382 83.3697 2.5022 81.6527 2.5022 81.6527C3.04757 72.488 5.14185 60.5892 5.81811 56.9364C5.949 56.2037 6.17844 55.4819 6.48385 54.8038C12.5593 41.2974 17.1291 29.6283 17.5 24.2038C17.7836 19.9824 19.8673 19.2059 20.8489 19.0747C21.0889 19.0419 21.0891 19.0528 21.569 19.0965C22.9106 19.2278 30.4358 20.2777 39.1509 12.0316C48.7604 2.93254 57.6721 1.94827 65.0892 2.70288C72.5063 3.45749 80.2946 8.12733 92.98 17.6967C105.676 27.266 109.177 37.9837 109.177 37.9837C128.058 92.6438 163.966 88.127 169.801 88.127C175.637 88.127 193.373 86.2897 194.769 86.1804C196.154 86.0601 197.223 84.6711 197.223 84.6711L205.97 72.6083C207.367 70.2242 209.559 70.0054 209.559 70.0054L213.05 69.5133C251.16 65.1169 251.487 65.5106 258.697 67.5994C265.94 69.6883 306.548 92.4141 309.144 94.3389C311.74 96.2637 309.81 99.5118 309.81 99.5118C309.81 99.5118 298.607 119.121 294.931 126.35C292.335 131.424 287.776 132.485 285.289 132.671C284.351 132.747 283.414 132.638 282.508 132.408L282.294 132.354C277.138 131.053 257.83 126.18 255.141 125.792C252.044 125.344 252.273 128.624 252.273 128.624C252.273 128.624 252.491 131.763 253.112 141.234C253.461 146.44 251.269 149.021 249.23 150.289C247.921 151.11 246.383 151.482 244.834 151.514Z"

private let SILVERSTONE_PATH =
    "M267.344 64.7614C268.447 71.5106 273.138 112.217 274.367 122.962C274.692 125.828 274.438 128.751 273.42 131.462C272.474 133.989 270.806 136.7 267.895 138.225C261.677 141.473 248.211 149.817 202.865 151.286C196.364 151.498 189.949 153.248 184.481 156.778C183.633 157.329 182.798 157.922 181.979 158.571C181.979 158.571 177.598 161.932 170.264 157.541C162.93 153.15 152.388 152.542 146.948 157.202C141.507 161.861 133.044 169.924 123.647 154.449C114.25 138.974 114.8 142.856 99.7925 135.444C84.7854 128.031 21.3517 97.9846 7.27721 85.5454C7.27721 85.5454 2.41631 82.1567 2.5011 75.0546C2.57175 67.9524 5.70895 64.6626 9.67976 62.4458C13.6506 60.2291 19.3734 58.3088 25.7041 53.7482C32.0348 49.2017 53.6266 27.8672 53.6266 27.8672C53.6266 27.8672 55.9728 25.8198 53.726 23.476L50.0801 20.2709C50.0801 20.2709 47.0276 18.0259 49.2038 14.1007C51.38 10.1754 59.3508 5.58659 59.3508 5.58659C59.3508 5.58659 63.9989 3.07331 68.5774 2.56501C68.5774 2.56501 71.1637 2.07083 73.8627 3.80753C74.8139 4.42051 82.9138 10.2411 93 17.5181C108.238 28.5116 128.009 42.8289 134.513 47.5356C137.099 49.4135 138.907 52.2657 139.176 55.4567C139.204 55.7391 139.219 56.0356 139.219 56.3321C139.219 60.5115 138.145 71.6094 137.679 73.925C137.438 75.1393 135.093 86.9997 145.14 96.7845C155.187 106.569 161.094 115.874 161.094 115.874C161.094 115.874 164.414 120.759 158.762 122.623C153.109 124.487 147.188 125.165 143.118 128.271C140.829 130.022 142.296 132.216 144.094 133.876C145.578 135.246 147.386 136.22 149.294 136.856C154.989 138.748 168.5 142.5 174.15 136.404L237.499 62.9683C237.499 62.9683 242.715 57.0945 240.878 50.5996C239.041 44.1046 234.716 44.1046 234.716 44.1046C234.716 44.1046 232.794 43.8646 230.151 43.9634C227.509 44.0622 220.642 44.6835 217.575 39.2051C214.509 33.7268 219.625 28.2484 219.625 28.2484C219.625 28.2484 222.026 25.1562 228.611 27.1471C235.196 29.152 248.677 36.6354 248.677 36.6354C248.677 36.6354 252.041 38.3297 256.789 43.328C262.356 49.1594 265.987 56.5862 267.302 64.5355L267.344 64.7614Z"

private let SPA_PATH =
    "M181.403 87.2138C190.301 90.2609 220.456 97.1401 225.284 98.8965C230.113 100.666 231.456 101.97 233.318 104.139C235.18 106.321 234.981 111.763 233.625 114.052C232.281 116.341 230.086 118.776 231.802 124.271C233.252 128.915 238.479 130.751 240.953 131.829C242.895 132.681 260.613 140.797 260.613 140.797C260.613 140.797 260.945 140.944 261.411 141.263C264.217 143.166 265.042 146.958 263.446 149.965L255.572 164.788C255.572 164.788 252.446 170.616 246.035 170.496C239.624 170.376 229.568 168.234 221.268 163.457C212.968 158.68 203.165 150.125 200.145 145.973C197.126 141.822 184.183 123.592 180.91 119.694C177.638 115.795 166.838 107.745 143.321 103.221C143.321 103.221 134.383 101.159 124.846 108.384C114.618 116.128 100.332 122.847 81.856 125.868C81.856 125.868 74.7397 126.999 71.1084 128.05C67.4905 129.088 67.8636 125.855 67.8636 125.855L67.6766 122.275C67.6766 122.275 67.5307 120.918 66.1607 120.199C65.2828 119.734 64.1918 120.426 63.5134 120.985C62.7153 121.65 61.9178 122.328 61.1065 122.967L44.8147 135.69L41.2161 138.5L6.76983 165.4C6.76983 165.4 2.10179 169.352 2.52743 163.817C2.82006 160.051 7.03611 149.087 9.69637 142.46C11.0664 139.054 12.7424 135.781 14.6844 132.667L16.4808 129.793C19.3938 125.123 22.7054 120.718 26.3633 116.62L35.0754 106.867C37.4962 104.152 40.0367 101.558 42.6171 99.003C44.6921 96.9538 47.8177 93.2414 50.7174 87.4134C51.2894 86.2691 51.7687 85.0981 52.2476 83.9139C53.0324 82.0244 55.7861 77.2742 63.9265 75.4513C73.0113 73.4022 75.3789 70.2486 96.5147 52.5383C101.326 48.4831 112.033 42.4658 116.785 39.9641L200.012 3.69186C200.012 3.69186 204.814 0.764542 208.578 4.07774L211.797 7.7236C211.797 7.7236 214.138 10.3582 218.834 8.60178C223.516 6.84539 229.048 4.25073 229.048 4.25073C229.048 4.25073 233.784 2.34795 236.91 5.12891C240.036 7.90987 265.388 36.3848 265.388 36.3848C265.388 36.3848 268.461 40.483 264.39 44.701C262.355 46.8167 260.28 47.0163 258.71 46.6837C257.353 46.4042 256.17 45.5925 255.278 44.5414L244.04 31.2487C244.04 31.2487 242.124 29.0665 239.304 28.8003C236.484 28.5342 232.122 31.0624 221.933 36.2783C211.744 41.4943 179.262 51.1545 179.262 51.1545C179.262 51.1545 173.742 52.6048 171.561 59.4042C171.029 61.0808 170.868 62.8372 170.922 64.5936L171.041 68.1064C171.121 70.6212 171.348 73.136 171.72 75.6243C171.72 75.6243 172.651 84.2199 181.403 87.2138Z"

private let CIRCUIT_DATA: [String: CircuitInfo] = [
    "shanghai":    CircuitInfo(pathData: SHANGHAI_PATH,    vw: 286, vh: 185, name: "SHANGHAI",    flagImageName: "china",      startFrac: 0.0000),
    "las-vegas":   CircuitInfo(pathData: LAS_VEGAS_PATH,   vw: 311, vh: 167, name: "LAS VEGAS",   flagImageName: "usa",        startFrac: 0.5093),
    "suzuka":      CircuitInfo(pathData: SUZUKA_PATH,      vw: 328, vh: 180, name: "SUZUKA",      flagImageName: "japan",      startFrac: 0.5665),
    "monaco":      CircuitInfo(pathData: MONACO_PATH,      vw: 337, vh: 139, name: "MONACO",      flagImageName: "monaco",     startFrac: 0.5067),
    "hungaroring": CircuitInfo(pathData: HUNGARORING_PATH, vw: 274, vh: 239, name: "HUNGARY",     flagImageName: "hungary",    startFrac: 0.4111),
    "marina-bay":  CircuitInfo(pathData: MARINA_BAY_PATH,  vw: 328, vh: 192, name: "MARINA BAY",  flagImageName: "singapore",  startFrac: 0.4461),
    "monza":       CircuitInfo(pathData: MONZA_PATH,       vw: 305, vh: 156, name: "MONZA",       flagImageName: "italy",      startFrac: 0.4410),
    "baku":        CircuitInfo(pathData: BAKU_PATH,        vw: 317, vh: 177, name: "BAKU",        flagImageName: "azerbaijan", startFrac: 0.4021),
    "albert-park": CircuitInfo(pathData: ALBERT_PARK_PATH, vw: 313, vh: 157, name: "ALBERT PARK", flagImageName: "australia",  startFrac: 0.0787),
    "silverstone": CircuitInfo(pathData: SILVERSTONE_PATH, vw: 277, vh: 166, name: "SILVERSTONE", flagImageName: "uk",         startFrac: 0.5578),
    "spa":         CircuitInfo(pathData: SPA_PATH,         vw: 269, vh: 173, name: "SPA",         flagImageName: "belgium",    startFrac: 0.4140),
]

// MARK: - SVG Path Parsing

private struct PathSeg {
    let from: CGPoint
    let to:   CGPoint
    let c1:   CGPoint?
    let c2:   CGPoint?
}

private func cubicPt(t: CGFloat, p0: CGPoint, p1: CGPoint, p2: CGPoint, p3: CGPoint) -> CGPoint {
    let u = 1 - t
    return CGPoint(
        x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
        y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
    )
}

private func segLen(_ seg: PathSeg) -> CGFloat {
    guard let c1 = seg.c1, let c2 = seg.c2 else {
        let dx = seg.to.x - seg.from.x; let dy = seg.to.y - seg.from.y
        return sqrt(dx*dx + dy*dy)
    }
    var len: CGFloat = 0; var prev = seg.from
    for i in 1...16 {
        let p = cubicPt(t: CGFloat(i)/16, p0: seg.from, p1: c1, p2: c2, p3: seg.to)
        let dx = p.x - prev.x; let dy = p.y - prev.y
        len += sqrt(dx*dx + dy*dy); prev = p
    }
    return len
}

private func ptAtFrac(_ segs: [PathSeg], _ frac: Double) -> CGPoint {
    guard !segs.isEmpty else { return .zero }
    let lens = segs.map { segLen($0) }
    let total = lens.reduce(0, +)
    guard total > 0 else { return segs[0].from }
    let target = CGFloat(max(0, min(1, frac))) * total
    var acc: CGFloat = 0
    for (i, seg) in segs.enumerated() {
        let l = lens[i]
        if acc + l >= target || i == segs.count - 1 {
            let t = l > 0 ? min(1, (target - acc) / l) : 0
            if let c1 = seg.c1, let c2 = seg.c2 {
                return cubicPt(t: t, p0: seg.from, p1: c1, p2: c2, p3: seg.to)
            }
            return CGPoint(
                x: seg.from.x + (seg.to.x - seg.from.x) * t,
                y: seg.from.y + (seg.to.y - seg.from.y) * t
            )
        }
        acc += l
    }
    return segs.last?.to ?? .zero
}

private func parseSegs(_ d: String) -> [PathSeg] {
    var segs: [PathSeg] = []
    var idx = d.startIndex
    var cx: Double = 0; var cy: Double = 0

    func skip() {
        while idx < d.endIndex {
            let c = d[idx]
            if c == " " || c == "," || c == "\n" || c == "\t" || c == "\r" { idx = d.index(after: idx) }
            else { break }
        }
    }
    func num() -> Double? {
        skip()
        guard idx < d.endIndex, !d[idx].isLetter else { return nil }
        var s = ""; var dot = false
        if d[idx] == "-" { s = "-"; idx = d.index(after: idx) }
        while idx < d.endIndex {
            let c = d[idx]
            if c.isNumber                   { s.append(c); idx = d.index(after: idx) }
            else if c == "." && !dot        { dot = true; s.append(c); idx = d.index(after: idx) }
            else                            { break }
        }
        return (s.isEmpty || s == "-") ? nil : Double(s)
    }

    while idx < d.endIndex {
        skip()
        guard idx < d.endIndex, d[idx].isLetter else { break }
        let cmd = d[idx]; idx = d.index(after: idx)

        switch cmd {
        case "M":
            guard let x = num(), let y = num() else { continue }
            cx = x; cy = y
            while true {
                skip(); if idx >= d.endIndex || d[idx].isLetter { break }
                guard let lx = num(), let ly = num() else { break }
                segs.append(PathSeg(from: .init(x: cx, y: cy), to: .init(x: lx, y: ly), c1: nil, c2: nil))
                cx = lx; cy = ly
            }
        case "L":
            while true {
                skip(); if idx >= d.endIndex || d[idx].isLetter { break }
                guard let x = num(), let y = num() else { break }
                segs.append(PathSeg(from: .init(x: cx, y: cy), to: .init(x: x, y: y), c1: nil, c2: nil))
                cx = x; cy = y
            }
        case "C":
            while true {
                skip(); if idx >= d.endIndex || d[idx].isLetter { break }
                guard let x1 = num(), let y1 = num(),
                      let x2 = num(), let y2 = num(),
                      let x  = num(), let y  = num() else { break }
                segs.append(PathSeg(from: .init(x: cx, y: cy), to: .init(x: x, y: y),
                                    c1: .init(x: x1, y: y1), c2: .init(x: x2, y: y2)))
                cx = x; cy = y
            }
        default: break
        }
    }
    return segs
}

// MARK: - Circuit Map View

private struct CircuitMapView: View {
    let circuitId: String
    let prog: Double
    let lineColor: Color
    let showDot: Bool

    var body: some View {
        Canvas { ctx, size in
            guard let info = CIRCUIT_DATA[circuitId] else { return }
            let scale = min(size.width / info.vw, size.height / info.vh)
            // Left-aligned within column (no horizontal centering offset)
            let ox: CGFloat = 0
            let oy = (size.height - info.vh * scale) / 2
            func tx(_ p: CGPoint) -> CGPoint { CGPoint(x: ox + p.x * scale, y: oy + p.y * scale) }

            let segs = parseSegs(info.pathData)
            let sw: CGFloat = 4
            let style = StrokeStyle(lineWidth: sw, lineCap: .round, lineJoin: .round)

            // Build full path
            var fullPath = Path()
            for (i, seg) in segs.enumerated() {
                if i == 0 { fullPath.move(to: tx(seg.from)) }
                if let c1 = seg.c1, let c2 = seg.c2 {
                    fullPath.addCurve(to: tx(seg.to), control1: tx(c1), control2: tx(c2))
                } else {
                    fullPath.addLine(to: tx(seg.to))
                }
            }

            // Unrun portion of track (white 50%)
            ctx.stroke(fullPath, with: .color(.white.opacity(0.5)), style: style)

            // Trail from startFrac → endFrac (mirrors running screen: startLen + p·(total - startLen))
            let startFrac = info.startFrac
            let p = CGFloat(max(0, min(1, prog)))
            let endFrac = startFrac + p * (1 - startFrac)
            if endFrac > startFrac {
                let trail = fullPath.trimmedPath(from: startFrac, to: endFrac)
                ctx.stroke(trail, with: .color(lineColor), style: style)
            }

            // Dot at runner's current position (= endFrac)
            if showDot {
                let dot = tx(ptAtFrac(segs, Double(endFrac)))
                ctx.fill(Path(ellipseIn: CGRect(x: dot.x - 8, y: dot.y - 8, width: 16, height: 16)),
                         with: .color(lineColor.opacity(0.5)))
                ctx.fill(Path(ellipseIn: CGRect(x: dot.x - 4, y: dot.y - 4, width: 8, height: 8)),
                         with: .color(lineColor))
            }
        }
    }
}

// MARK: - Constants

private let BG_COLOR = Color(hex: "#17171C")
private let GREY     = Color(hex: "#666666")

// Sector palette — mirrors src/constants/colors.ts PALETTE
private func sectorColor(_ sector: String) -> Color {
    switch sector {
    case "yellow": return Color(hex: "#FCB827")
    case "green":  return Color(hex: "#59B345")
    case "purple": return Color(hex: "#8528C5")
    default:       return Color(hex: "#FCB827")
    }
}

/// Theme accent: sector color normally, white when in pit.
/// Mirrors RunningScreen.tsx `isInPitTheme ? PALETTE.white : sectorTheme` pattern.
private func themeColor(sector: String, inPit: Bool) -> Color {
    inPit ? Color.white : sectorColor(sector)
}

// MARK: - Bar Ratios
// Snapshot of BoxBoxSheet wave animation (BoxBoxSheet.tsx WAVE_BASE_Y_IN_GROUP=54).
// Matches BAR_HEIGHTS [28,42,34,54,46,36,46,40,32,22,34,42,50] / 54 — 13 bars.
private let BAR_RATIOS: [CGFloat] = [
    0.52, 0.78, 0.63, 1.00, 0.85, 0.67, 0.85, 0.74, 0.59, 0.41, 0.63, 0.78, 0.93
]

// MARK: - Lock Normal View

private struct LockNormalView: View {
    let circuitId: String
    let prog: Double
    let sector: String
    let distKm: Double
    let paceS: Int
    let inPit: Bool

    var body: some View {
        let color = themeColor(sector: sector, inPit: inPit)
        let info = CIRCUIT_DATA[circuitId] ?? CIRCUIT_DATA["spa"]!

        HStack(alignment: .top, spacing: 0) {
            // 왼쪽: 국기 + 서킷명 + 서킷맵
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Image(info.flagImageName)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 20, height: 13)
                        .clipShape(RoundedRectangle(cornerRadius: 2))
                    Text(info.name)
                        .font(.custom("Formula1-Display-Bold", size: 15))
                        .foregroundStyle(Color.white)
                        .lineLimit(1)
                }
                Color.clear.frame(height: 20)
                CircuitMapView(
                    circuitId: circuitId,
                    prog: prog,
                    lineColor: color,
                    showDot: true
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.leading, 24)
            .padding(.top, 20)
            .padding(.bottom, 30)

            // 오른쪽: DISTANCE + PACE (PACE 값 하단 고정, 가장 넓은 텍스트 기준 왼쪽 정렬)
            VStack(alignment: .leading, spacing: 0) {
                Text("DISTANCE")
                    .font(.custom("Formula1-Display-Regular", size: 13))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .tracking(0.3)
                Color.clear.frame(height: 4)
                Text(String(format: "%.2f", distKm))
                    .font(.custom("Formula1-Display-Bold", size: 30).monospacedDigit())
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .offset(x: -1)
                Color.clear.frame(height: 16)
                Spacer(minLength: 0)
                Text("PACE")
                    .font(.custom("Formula1-Display-Regular", size: 13))
                    .foregroundStyle(Color.white.opacity(0.4))
                    .tracking(0.3)
                Color.clear.frame(height: 4)
                if inPit {
                    Text("IN PIT")
                        .font(.custom("Formula1-Display-Bold", size: 28))
                        .foregroundStyle(Color.white)
                        .lineLimit(1)
                } else {
                    Text(formatPace(paceS))
                        .font(.custom("Formula1-Display-Bold", size: 30).monospacedDigit())
                        .foregroundStyle(color)
                        .lineLimit(1)
                        .offset(x: -1)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
            .padding(.top, 20)
            .padding(.bottom, 20)
            .padding(.trailing, 24)
        }
    }
}

// MARK: - Lock Wave View

private struct LockWaveView: View {
    let teamColor: Color
    let line1: String
    let line2: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text(line1)
                    .font(.custom("Formula1-Display-Italic", size: 24))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                if let l2 = line2 {
                    Text(l2)
                        .font(.custom("Formula1-Display-Italic", size: 24))
                        .foregroundStyle(Color.white)
                        .lineLimit(1)
                }
            }
            .padding(.leading, 24)
            // 24pt Italic 텍스트의 cap height가 더 크므로 .padding(.top, 20) 시 LockNormalView(15pt+image)
            // 보다 시각적으로 좁아 보임 → 6pt 추가 보정
            .padding(.top, 26)

            Color.clear.frame(height: 12)

            GeometryReader { geo in
                let W = geo.size.width
                let H = geo.size.height
                let count = BAR_RATIOS.count
                let barW = W / CGFloat(count)
                let maxBarH = H
                let fadeW = barW * 2

                ZStack(alignment: .bottom) {
                    LinearGradient(
                        colors: [teamColor.opacity(0), teamColor.opacity(0.25)],
                        startPoint: .top, endPoint: .bottom
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                    HStack(alignment: .bottom, spacing: 0) {
                        ForEach(0..<count, id: \.self) { i in
                            LinearGradient(
                                colors: [teamColor.opacity(0), teamColor.opacity(1)],
                                startPoint: .top, endPoint: .bottom
                            )
                            .frame(width: barW, height: maxBarH * BAR_RATIOS[i])
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                    HStack(spacing: 0) {
                        LinearGradient(
                            colors: [BG_COLOR, BG_COLOR.opacity(0)],
                            startPoint: .leading, endPoint: .trailing
                        )
                        .frame(width: fadeW)
                        Spacer()
                        LinearGradient(
                            colors: [BG_COLOR.opacity(0), BG_COLOR],
                            startPoint: .leading, endPoint: .trailing
                        )
                        .frame(width: fadeW)
                    }
                    .frame(width: W, height: H)
                }
            }
            .frame(minHeight: 60)
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }
}

// MARK: - Live Activity View

struct PitRunLiveActivityView: View {
    let context: ActivityViewContext<PitRunAttributes>

    var body: some View {
        let state   = context.state
        let teamClr = Color(hex: context.attributes.teamColor)

        ZStack {
            BG_COLOR
            switch state.pitPhase {
            case "boxbox":
                LockWaveView(teamColor: teamClr, line1: "\u{201C}BOX BOX", line2: " RECOVERY TIME\u{201D}")
            case "fullPush":
                LockWaveView(teamColor: teamClr, line1: "\u{201C}FULL PUSH\u{201D}", line2: nil)
            case "completed":
                Link(destination: URL(string: "pitrun://result")!) {
                    LockWaveView(teamColor: teamClr, line1: "\u{201C}Well done, mate\u{201D}", line2: nil)
                }
            case "inPit":
                LockNormalView(
                    circuitId: context.attributes.circuitId,
                    prog: state.prog,
                    sector: state.sector,
                    distKm: state.distKm,
                    paceS: state.paceS,
                    inPit: true
                )
            default:
                LockNormalView(
                    circuitId: context.attributes.circuitId,
                    prog: state.prog,
                    sector: state.sector,
                    distKm: state.distKm,
                    paceS: state.paceS,
                    inPit: false
                )
            }
        }
    }
}

// MARK: - Widget Configuration

struct PitRunLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PitRunAttributes.self) { context in
            PitRunLiveActivityView(context: context)
        } dynamicIsland: { context in
            let state   = context.state
            let teamClr = Color(hex: context.attributes.teamColor)
            let pitMode = state.pitPhase == "inPit"
            let isPaused = state.isPaused
            let accentColor = themeColor(sector: state.sector, inPit: pitMode)

            let leftBtn: String
            let rightBtn: String
            if pitMode {
                leftBtn  = isPaused ? "inpit-play" : "inpit-pause"
                rightBtn = "inpit-stop"
            } else {
                leftBtn  = isPaused ? "play-\(state.sector)" : "pause-\(state.sector)"
                rightBtn = "stop-\(state.sector)"
            }

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 12) {
                        Link(destination: URL(string: isPaused ? "pitrun://resume" : "pitrun://pause")!) {
                            Image(leftBtn)
                                .resizable()
                                .frame(width: 48, height: 48)
                        }
                        Link(destination: URL(string: "pitrun://stop")!) {
                            Image(rightBtn)
                                .resizable()
                                .frame(width: 48, height: 48)
                        }
                    }
                    .padding(.leading, 0)
                    .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    HStack(alignment: .lastTextBaseline, spacing: 2) {
                        Text(String(format: "%.2f", state.distKm))
                            .font(.custom("Formula1-Display-Bold", size: 26).monospacedDigit())
                            .foregroundStyle(accentColor)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        Text("km")
                            .font(.custom("Formula1-Display-Regular", size: 18))
                            .foregroundStyle(accentColor)
                            .lineLimit(1)
                    }
                    .padding(.trailing, 12)
                    .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    EmptyView()
                }
            } compactLeading: {
                Image("race-flag")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 24, height: 24)
            } compactTrailing: {
                Text(String(format: "%.2f", state.distKm))
                    .font(.custom("Formula1-Display-Regular", size: 13).monospacedDigit())
                    .foregroundStyle(Color.white)
            } minimal: {
                Image("race-flag")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
            }
        }
    }
}

// MARK: - Preview

@available(iOS 18.0, *)
#Preview("Lock Screen", as: .content, using: PitRunAttributes(
    driverName: "LECLERC", teamColor: "#E8002D", circuitId: "monaco"
)) {
    PitRunLiveActivity()
} contentStates: {
    PitRunAttributes.PitRunState(distKm: 2.14, elapsedMs: 720_000, paceS: 336, sector: "purple", tire: "soft",   pitPhase: "none",     prog: 0.64, isPaused: false)
    PitRunAttributes.PitRunState(distKm: 2.14, elapsedMs: 720_000, paceS: 0,   sector: "yellow", tire: "medium", pitPhase: "inPit",    prog: 0.64, isPaused: false)
    PitRunAttributes.PitRunState(distKm: 2.14, elapsedMs: 720_000, paceS: 0,   sector: "yellow", tire: "medium", pitPhase: "boxbox",   prog: 0.64, isPaused: false)
    PitRunAttributes.PitRunState(distKm: 2.14, elapsedMs: 720_000, paceS: 342, sector: "green",  tire: "hard",   pitPhase: "fullPush", prog: 0.64, isPaused: false)
}

@available(iOS 18.0, *)
#Preview("DI Compact", as: .dynamicIsland(.compact), using: PitRunAttributes(
    driverName: "LECLERC", teamColor: "#E8002D", circuitId: "shanghai"
)) {
    PitRunLiveActivity()
} contentStates: {
    PitRunAttributes.PitRunState(distKm: 5.22, elapsedMs: 1_800_000, paceS: 315, sector: "green", tire: "soft", pitPhase: "none", prog: 0.42, isPaused: false)
}

@available(iOS 18.0, *)
#Preview("DI Expanded", as: .dynamicIsland(.expanded), using: PitRunAttributes(
    driverName: "LECLERC", teamColor: "#1E41FF", circuitId: "silverstone"
)) {
    PitRunLiveActivity()
} contentStates: {
    PitRunAttributes.PitRunState(distKm: 3.55, elapsedMs: 1_120_000, paceS: 315, sector: "purple", tire: "medium", pitPhase: "none", prog: 0.60, isPaused: false)
}

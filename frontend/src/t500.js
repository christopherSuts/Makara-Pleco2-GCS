const pwmMap = {
    "1100": {
        "rpm": 2378,
        "current": 22.39,
        "voltage": 16,
        "power": 358.3,
        "force": -6.1,
        "efficiency": 17.0
    },
    "1104": {
        "rpm": 2361,
        "current": 21.96,
        "voltage": 16,
        "power": 351.3,
        "force": -6.01,
        "efficiency": 17.1
    },
    "1108": {
        "rpm": 2345,
        "current": 21.52,
        "voltage": 16,
        "power": 344.4,
        "force": -5.93,
        "efficiency": 17.2
    },
    "1112": {
        "rpm": 2328,
        "current": 21.09,
        "voltage": 16,
        "power": 337.4,
        "force": -5.84,
        "efficiency": 17.3
    },
    "1116": {
        "rpm": 2312,
        "current": 20.65,
        "voltage": 16,
        "power": 330.4,
        "force": -5.76,
        "efficiency": 17.4
    },
    "1120": {
        "rpm": 2295,
        "current": 20.22,
        "voltage": 16,
        "power": 323.5,
        "force": -5.68,
        "efficiency": 17.5
    },
    "1124": {
        "rpm": 2279,
        "current": 19.78,
        "voltage": 16,
        "power": 316.5,
        "force": -5.59,
        "efficiency": 17.7
    },
    "1128": {
        "rpm": 2262,
        "current": 19.35,
        "voltage": 16,
        "power": 309.6,
        "force": -5.51,
        "efficiency": 17.8
    },
    "1132": {
        "rpm": 2246,
        "current": 18.91,
        "voltage": 16,
        "power": 302.6,
        "force": -5.42,
        "efficiency": 17.9
    },
    "1136": {
        "rpm": 2229,
        "current": 18.48,
        "voltage": 16,
        "power": 295.7,
        "force": -5.34,
        "efficiency": 18.1
    },
    "1140": {
        "rpm": 2212,
        "current": 18.05,
        "voltage": 16,
        "power": 288.8,
        "force": -5.26,
        "efficiency": 18.2
    },
    "1144": {
        "rpm": 2197,
        "current": 17.65,
        "voltage": 16,
        "power": 282.4,
        "force": -5.18,
        "efficiency": 18.3
    },
    "1148": {
        "rpm": 2180,
        "current": 17.23,
        "voltage": 16,
        "power": 275.8,
        "force": -5.09,
        "efficiency": 18.5
    },
    "1152": {
        "rpm": 2163,
        "current": 16.79,
        "voltage": 16,
        "power": 268.6,
        "force": -5.0,
        "efficiency": 18.6
    },
    "1156": {
        "rpm": 2144,
        "current": 16.34,
        "voltage": 16,
        "power": 261.5,
        "force": -4.91,
        "efficiency": 18.8
    },
    "1160": {
        "rpm": 2125,
        "current": 15.89,
        "voltage": 16,
        "power": 254.2,
        "force": -4.82,
        "efficiency": 19.0
    },
    "1164": {
        "rpm": 2107,
        "current": 15.46,
        "voltage": 16,
        "power": 247.4,
        "force": -4.74,
        "efficiency": 19.1
    },
    "1168": {
        "rpm": 2088,
        "current": 15.05,
        "voltage": 16,
        "power": 240.8,
        "force": -4.65,
        "efficiency": 19.3
    },
    "1172": {
        "rpm": 2070,
        "current": 14.64,
        "voltage": 16,
        "power": 234.3,
        "force": -4.56,
        "efficiency": 19.5
    },
    "1176": {
        "rpm": 2052,
        "current": 14.24,
        "voltage": 16,
        "power": 227.9,
        "force": -4.48,
        "efficiency": 19.7
    },
    "1180": {
        "rpm": 2034,
        "current": 13.87,
        "voltage": 16,
        "power": 222.0,
        "force": -4.4,
        "efficiency": 19.8
    },
    "1184": {
        "rpm": 2016,
        "current": 13.5,
        "voltage": 16,
        "power": 216.0,
        "force": -4.32,
        "efficiency": 20.0
    },
    "1188": {
        "rpm": 1998,
        "current": 13.13,
        "voltage": 16,
        "power": 210.1,
        "force": -4.24,
        "efficiency": 20.2
    },
    "1192": {
        "rpm": 1980,
        "current": 12.76,
        "voltage": 16,
        "power": 204.2,
        "force": -4.16,
        "efficiency": 20.4
    },
    "1196": {
        "rpm": 1960,
        "current": 12.38,
        "voltage": 16,
        "power": 198.2,
        "force": -4.07,
        "efficiency": 20.6
    },
    "1200": {
        "rpm": 1941,
        "current": 12.02,
        "voltage": 16,
        "power": 192.2,
        "force": -3.99,
        "efficiency": 20.8
    },
    "1204": {
        "rpm": 1922,
        "current": 11.66,
        "voltage": 16,
        "power": 186.5,
        "force": -3.91,
        "efficiency": 21.0
    },
    "1208": {
        "rpm": 1902,
        "current": 11.3,
        "voltage": 16,
        "power": 180.8,
        "force": -3.83,
        "efficiency": 21.2
    },
    "1212": {
        "rpm": 1883,
        "current": 10.96,
        "voltage": 16,
        "power": 175.3,
        "force": -3.75,
        "efficiency": 21.4
    },
    "1216": {
        "rpm": 1864,
        "current": 10.62,
        "voltage": 16,
        "power": 169.9,
        "force": -3.67,
        "efficiency": 21.6
    },
    "1220": {
        "rpm": 1845,
        "current": 10.3,
        "voltage": 16,
        "power": 164.8,
        "force": -3.6,
        "efficiency": 21.8
    },
    "1224": {
        "rpm": 1826,
        "current": 9.99,
        "voltage": 16,
        "power": 159.9,
        "force": -3.53,
        "efficiency": 22.1
    },
    "1228": {
        "rpm": 1807,
        "current": 9.69,
        "voltage": 16,
        "power": 155.1,
        "force": -3.45,
        "efficiency": 22.3
    },
    "1232": {
        "rpm": 1788,
        "current": 9.39,
        "voltage": 16,
        "power": 150.3,
        "force": -3.38,
        "efficiency": 22.5
    },
    "1236": {
        "rpm": 1768,
        "current": 9.09,
        "voltage": 16,
        "power": 145.5,
        "force": -3.3,
        "efficiency": 22.7
    },
    "1240": {
        "rpm": 1748,
        "current": 8.8,
        "voltage": 16,
        "power": 140.8,
        "force": -3.23,
        "efficiency": 22.9
    },
    "1244": {
        "rpm": 1728,
        "current": 8.51,
        "voltage": 16,
        "power": 136.1,
        "force": -3.16,
        "efficiency": 23.2
    },
    "1248": {
        "rpm": 1708,
        "current": 8.22,
        "voltage": 16,
        "power": 131.5,
        "force": -3.08,
        "efficiency": 23.4
    },
    "1252": {
        "rpm": 1687,
        "current": 7.93,
        "voltage": 16,
        "power": 127.0,
        "force": -3.01,
        "efficiency": 23.7
    },
    "1256": {
        "rpm": 1667,
        "current": 7.68,
        "voltage": 16,
        "power": 122.9,
        "force": -2.94,
        "efficiency": 23.9
    },
    "1260": {
        "rpm": 1646,
        "current": 7.43,
        "voltage": 16,
        "power": 118.9,
        "force": -2.86,
        "efficiency": 24.1
    },
    "1264": {
        "rpm": 1625,
        "current": 7.17,
        "voltage": 16,
        "power": 114.7,
        "force": -2.79,
        "efficiency": 24.3
    },
    "1268": {
        "rpm": 1605,
        "current": 6.95,
        "voltage": 16,
        "power": 111.1,
        "force": -2.72,
        "efficiency": 24.5
    },
    "1272": {
        "rpm": 1585,
        "current": 6.73,
        "voltage": 16,
        "power": 107.6,
        "force": -2.65,
        "efficiency": 24.7
    },
    "1276": {
        "rpm": 1564,
        "current": 6.5,
        "voltage": 16,
        "power": 104.1,
        "force": -2.58,
        "efficiency": 24.8
    },
    "1280": {
        "rpm": 1543,
        "current": 6.29,
        "voltage": 16,
        "power": 100.6,
        "force": -2.51,
        "efficiency": 25.0
    },
    "1284": {
        "rpm": 1522,
        "current": 6.08,
        "voltage": 16,
        "power": 97.3,
        "force": -2.44,
        "efficiency": 25.1
    },
    "1288": {
        "rpm": 1499,
        "current": 5.87,
        "voltage": 16,
        "power": 94.0,
        "force": -2.37,
        "efficiency": 25.2
    },
    "1292": {
        "rpm": 1477,
        "current": 5.67,
        "voltage": 16,
        "power": 90.7,
        "force": -2.3,
        "efficiency": 25.3
    },
    "1296": {
        "rpm": 1456,
        "current": 5.47,
        "voltage": 16,
        "power": 87.5,
        "force": -2.23,
        "efficiency": 25.5
    },
    "1300": {
        "rpm": 1433,
        "current": 5.27,
        "voltage": 16,
        "power": 84.3,
        "force": -2.16,
        "efficiency": 25.6
    },
    "1304": {
        "rpm": 1411,
        "current": 5.07,
        "voltage": 16,
        "power": 81.1,
        "force": -2.09,
        "efficiency": 25.8
    },
    "1308": {
        "rpm": 1389,
        "current": 4.88,
        "voltage": 16,
        "power": 78.1,
        "force": -2.03,
        "efficiency": 26.0
    },
    "1312": {
        "rpm": 1367,
        "current": 4.69,
        "voltage": 16,
        "power": 75.1,
        "force": -1.96,
        "efficiency": 26.1
    },
    "1316": {
        "rpm": 1345,
        "current": 4.52,
        "voltage": 16,
        "power": 72.3,
        "force": -1.9,
        "efficiency": 26.2
    },
    "1320": {
        "rpm": 1323,
        "current": 4.35,
        "voltage": 16,
        "power": 69.6,
        "force": -1.84,
        "efficiency": 26.4
    },
    "1324": {
        "rpm": 1302,
        "current": 4.15,
        "voltage": 16,
        "power": 66.5,
        "force": -1.78,
        "efficiency": 26.7
    },
    "1328": {
        "rpm": 1280,
        "current": 3.95,
        "voltage": 16,
        "power": 63.2,
        "force": -1.7,
        "efficiency": 26.9
    },
    "1332": {
        "rpm": 1257,
        "current": 3.77,
        "voltage": 16,
        "power": 60.3,
        "force": -1.63,
        "efficiency": 27.0
    },
    "1336": {
        "rpm": 1234,
        "current": 3.57,
        "voltage": 16,
        "power": 57.1,
        "force": -1.56,
        "efficiency": 27.3
    },
    "1340": {
        "rpm": 1211,
        "current": 3.37,
        "voltage": 16,
        "power": 53.9,
        "force": -1.49,
        "efficiency": 27.7
    },
    "1344": {
        "rpm": 1187,
        "current": 3.19,
        "voltage": 16,
        "power": 51.1,
        "force": -1.44,
        "efficiency": 28.1
    },
    "1348": {
        "rpm": 1163,
        "current": 3.02,
        "voltage": 16,
        "power": 48.4,
        "force": -1.38,
        "efficiency": 28.6
    },
    "1352": {
        "rpm": 1140,
        "current": 2.86,
        "voltage": 16,
        "power": 45.7,
        "force": -1.33,
        "efficiency": 29.1
    },
    "1356": {
        "rpm": 1116,
        "current": 2.7,
        "voltage": 16,
        "power": 43.2,
        "force": -1.28,
        "efficiency": 29.7
    },
    "1360": {
        "rpm": 1093,
        "current": 2.55,
        "voltage": 16,
        "power": 40.8,
        "force": -1.23,
        "efficiency": 30.2
    },
    "1364": {
        "rpm": 1069,
        "current": 2.4,
        "voltage": 16,
        "power": 38.5,
        "force": -1.19,
        "efficiency": 30.8
    },
    "1368": {
        "rpm": 1046,
        "current": 2.27,
        "voltage": 16,
        "power": 36.3,
        "force": -1.14,
        "efficiency": 31.4
    },
    "1372": {
        "rpm": 1022,
        "current": 2.13,
        "voltage": 16,
        "power": 34.1,
        "force": -1.09,
        "efficiency": 31.9
    },
    "1376": {
        "rpm": 998,
        "current": 2.0,
        "voltage": 16,
        "power": 32.1,
        "force": -1.04,
        "efficiency": 32.5
    },
    "1380": {
        "rpm": 972,
        "current": 1.88,
        "voltage": 16,
        "power": 30.1,
        "force": -0.99,
        "efficiency": 33.1
    },
    "1384": {
        "rpm": 947,
        "current": 1.76,
        "voltage": 16,
        "power": 28.1,
        "force": -0.94,
        "efficiency": 33.6
    },
    "1388": {
        "rpm": 922,
        "current": 1.64,
        "voltage": 16,
        "power": 26.3,
        "force": -0.89,
        "efficiency": 34.0
    },
    "1392": {
        "rpm": 894,
        "current": 1.53,
        "voltage": 16,
        "power": 24.4,
        "force": -0.84,
        "efficiency": 34.6
    },
    "1396": {
        "rpm": 869,
        "current": 1.43,
        "voltage": 16,
        "power": 22.9,
        "force": -0.81,
        "efficiency": 35.3
    },
    "1400": {
        "rpm": 843,
        "current": 1.34,
        "voltage": 16,
        "power": 21.5,
        "force": -0.78,
        "efficiency": 36.1
    },
    "1404": {
        "rpm": 817,
        "current": 1.26,
        "voltage": 16,
        "power": 20.2,
        "force": -0.74,
        "efficiency": 36.7
    },
    "1408": {
        "rpm": 791,
        "current": 1.18,
        "voltage": 16,
        "power": 18.9,
        "force": -0.7,
        "efficiency": 37.2
    },
    "1412": {
        "rpm": 767,
        "current": 1.1,
        "voltage": 16,
        "power": 17.5,
        "force": -0.66,
        "efficiency": 37.5
    },
    "1416": {
        "rpm": 741,
        "current": 1.01,
        "voltage": 16,
        "power": 16.2,
        "force": -0.61,
        "efficiency": 37.9
    },
    "1420": {
        "rpm": 715,
        "current": 0.93,
        "voltage": 16,
        "power": 14.9,
        "force": -0.57,
        "efficiency": 38.2
    },
    "1424": {
        "rpm": 689,
        "current": 0.86,
        "voltage": 16,
        "power": 13.7,
        "force": -0.53,
        "efficiency": 38.4
    },
    "1428": {
        "rpm": 661,
        "current": 0.78,
        "voltage": 16,
        "power": 12.5,
        "force": -0.48,
        "efficiency": 38.6
    },
    "1432": {
        "rpm": 633,
        "current": 0.71,
        "voltage": 16,
        "power": 11.4,
        "force": -0.44,
        "efficiency": 38.7
    },
    "1436": {
        "rpm": 606,
        "current": 0.65,
        "voltage": 16,
        "power": 10.3,
        "force": -0.4,
        "efficiency": 39.0
    },
    "1440": {
        "rpm": 578,
        "current": 0.58,
        "voltage": 16,
        "power": 9.2,
        "force": -0.36,
        "efficiency": 39.3
    },
    "1444": {
        "rpm": 551,
        "current": 0.51,
        "voltage": 16,
        "power": 8.1,
        "force": -0.32,
        "efficiency": 39.7
    },
    "1448": {
        "rpm": 524,
        "current": 0.44,
        "voltage": 16,
        "power": 7.0,
        "force": -0.28,
        "efficiency": 40.2
    },
    "1452": {
        "rpm": 497,
        "current": 0.37,
        "voltage": 16,
        "power": 6.0,
        "force": -0.24,
        "efficiency": 40.9
    },
    "1456": {
        "rpm": 469,
        "current": 0.3,
        "voltage": 16,
        "power": 4.9,
        "force": -0.2,
        "efficiency": 42.0
    },
    "1460": {
        "rpm": 442,
        "current": 0.23,
        "voltage": 16,
        "power": 3.8,
        "force": -0.16,
        "efficiency": 43.6
    },
    "1464": {
        "rpm": 415,
        "current": 0.17,
        "voltage": 16,
        "power": 2.7,
        "force": -0.12,
        "efficiency": 46.7
    },
    "1468": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1472": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1476": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1480": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1484": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1488": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1492": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1496": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1500": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1504": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1508": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1512": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1516": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1520": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1524": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1528": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1532": {
        "rpm": 0,
        "current": 0.0,
        "voltage": 16,
        "power": 0.0,
        "force": 0.0,
        "efficiency": 0.0
    },
    "1536": {
        "rpm": 411,
        "current": 0.16,
        "voltage": 16,
        "power": 2.5,
        "force": 0.19,
        "efficiency": 74.8
    },
    "1540": {
        "rpm": 438,
        "current": 0.23,
        "voltage": 16,
        "power": 3.7,
        "force": 0.25,
        "efficiency": 67.0
    },
    "1544": {
        "rpm": 465,
        "current": 0.31,
        "voltage": 16,
        "power": 4.9,
        "force": 0.31,
        "efficiency": 63.1
    },
    "1548": {
        "rpm": 491,
        "current": 0.38,
        "voltage": 16,
        "power": 6.1,
        "force": 0.37,
        "efficiency": 60.6
    },
    "1552": {
        "rpm": 518,
        "current": 0.46,
        "voltage": 16,
        "power": 7.3,
        "force": 0.43,
        "efficiency": 59.0
    },
    "1556": {
        "rpm": 544,
        "current": 0.53,
        "voltage": 16,
        "power": 8.5,
        "force": 0.49,
        "efficiency": 57.9
    },
    "1560": {
        "rpm": 571,
        "current": 0.61,
        "voltage": 16,
        "power": 9.7,
        "force": 0.55,
        "efficiency": 57.0
    },
    "1564": {
        "rpm": 598,
        "current": 0.68,
        "voltage": 16,
        "power": 10.9,
        "force": 0.61,
        "efficiency": 56.3
    },
    "1568": {
        "rpm": 624,
        "current": 0.76,
        "voltage": 16,
        "power": 12.1,
        "force": 0.68,
        "efficiency": 55.7
    },
    "1572": {
        "rpm": 651,
        "current": 0.83,
        "voltage": 16,
        "power": 13.3,
        "force": 0.74,
        "efficiency": 55.4
    },
    "1576": {
        "rpm": 679,
        "current": 0.91,
        "voltage": 16,
        "power": 14.6,
        "force": 0.81,
        "efficiency": 55.0
    },
    "1580": {
        "rpm": 704,
        "current": 1.0,
        "voltage": 16,
        "power": 15.9,
        "force": 0.87,
        "efficiency": 54.7
    },
    "1584": {
        "rpm": 729,
        "current": 1.08,
        "voltage": 16,
        "power": 17.4,
        "force": 0.94,
        "efficiency": 54.1
    },
    "1588": {
        "rpm": 755,
        "current": 1.18,
        "voltage": 16,
        "power": 18.9,
        "force": 1.01,
        "efficiency": 53.4
    },
    "1592": {
        "rpm": 779,
        "current": 1.28,
        "voltage": 16,
        "power": 20.5,
        "force": 1.08,
        "efficiency": 52.6
    },
    "1596": {
        "rpm": 803,
        "current": 1.39,
        "voltage": 16,
        "power": 22.3,
        "force": 1.15,
        "efficiency": 51.8
    },
    "1600": {
        "rpm": 829,
        "current": 1.51,
        "voltage": 16,
        "power": 24.1,
        "force": 1.23,
        "efficiency": 51.0
    },
    "1604": {
        "rpm": 854,
        "current": 1.63,
        "voltage": 16,
        "power": 26.0,
        "force": 1.31,
        "efficiency": 50.3
    },
    "1608": {
        "rpm": 879,
        "current": 1.75,
        "voltage": 16,
        "power": 28.1,
        "force": 1.39,
        "efficiency": 49.4
    },
    "1612": {
        "rpm": 904,
        "current": 1.89,
        "voltage": 16,
        "power": 30.2,
        "force": 1.47,
        "efficiency": 48.7
    },
    "1616": {
        "rpm": 929,
        "current": 2.02,
        "voltage": 16,
        "power": 32.3,
        "force": 1.54,
        "efficiency": 47.8
    },
    "1620": {
        "rpm": 953,
        "current": 2.15,
        "voltage": 16,
        "power": 34.5,
        "force": 1.63,
        "efficiency": 47.2
    },
    "1624": {
        "rpm": 977,
        "current": 2.29,
        "voltage": 16,
        "power": 36.7,
        "force": 1.71,
        "efficiency": 46.5
    },
    "1628": {
        "rpm": 1000,
        "current": 2.44,
        "voltage": 16,
        "power": 39.0,
        "force": 1.78,
        "efficiency": 45.6
    },
    "1632": {
        "rpm": 1024,
        "current": 2.58,
        "voltage": 16,
        "power": 41.3,
        "force": 1.85,
        "efficiency": 44.8
    },
    "1636": {
        "rpm": 1046,
        "current": 2.73,
        "voltage": 16,
        "power": 43.7,
        "force": 1.92,
        "efficiency": 43.9
    },
    "1640": {
        "rpm": 1069,
        "current": 2.89,
        "voltage": 16,
        "power": 46.3,
        "force": 2.0,
        "efficiency": 43.1
    },
    "1644": {
        "rpm": 1092,
        "current": 3.06,
        "voltage": 16,
        "power": 48.9,
        "force": 2.07,
        "efficiency": 42.3
    },
    "1648": {
        "rpm": 1115,
        "current": 3.23,
        "voltage": 16,
        "power": 51.6,
        "force": 2.15,
        "efficiency": 41.5
    },
    "1652": {
        "rpm": 1138,
        "current": 3.4,
        "voltage": 16,
        "power": 54.5,
        "force": 2.22,
        "efficiency": 40.8
    },
    "1656": {
        "rpm": 1160,
        "current": 3.58,
        "voltage": 16,
        "power": 57.4,
        "force": 2.3,
        "efficiency": 40.1
    },
    "1660": {
        "rpm": 1184,
        "current": 3.77,
        "voltage": 16,
        "power": 60.3,
        "force": 2.38,
        "efficiency": 39.5
    },
    "1664": {
        "rpm": 1206,
        "current": 3.96,
        "voltage": 16,
        "power": 63.3,
        "force": 2.46,
        "efficiency": 38.9
    },
    "1668": {
        "rpm": 1229,
        "current": 4.15,
        "voltage": 16,
        "power": 66.3,
        "force": 2.55,
        "efficiency": 38.4
    },
    "1672": {
        "rpm": 1251,
        "current": 4.34,
        "voltage": 16,
        "power": 69.4,
        "force": 2.63,
        "efficiency": 37.9
    },
    "1676": {
        "rpm": 1272,
        "current": 4.54,
        "voltage": 16,
        "power": 72.6,
        "force": 2.71,
        "efficiency": 37.4
    },
    "1680": {
        "rpm": 1294,
        "current": 4.72,
        "voltage": 16,
        "power": 75.5,
        "force": 2.8,
        "efficiency": 37.1
    },
    "1684": {
        "rpm": 1316,
        "current": 4.9,
        "voltage": 16,
        "power": 78.4,
        "force": 2.9,
        "efficiency": 36.9
    },
    "1688": {
        "rpm": 1337,
        "current": 5.08,
        "voltage": 16,
        "power": 81.4,
        "force": 2.98,
        "efficiency": 36.6
    },
    "1692": {
        "rpm": 1359,
        "current": 5.28,
        "voltage": 16,
        "power": 84.4,
        "force": 3.07,
        "efficiency": 36.4
    },
    "1696": {
        "rpm": 1380,
        "current": 5.48,
        "voltage": 16,
        "power": 87.7,
        "force": 3.17,
        "efficiency": 36.2
    },
    "1700": {
        "rpm": 1401,
        "current": 5.69,
        "voltage": 16,
        "power": 91.0,
        "force": 3.27,
        "efficiency": 35.9
    },
    "1704": {
        "rpm": 1422,
        "current": 5.9,
        "voltage": 16,
        "power": 94.4,
        "force": 3.37,
        "efficiency": 35.7
    },
    "1708": {
        "rpm": 1443,
        "current": 6.11,
        "voltage": 16,
        "power": 97.8,
        "force": 3.47,
        "efficiency": 35.5
    },
    "1712": {
        "rpm": 1464,
        "current": 6.34,
        "voltage": 16,
        "power": 101.4,
        "force": 3.58,
        "efficiency": 35.3
    },
    "1716": {
        "rpm": 1486,
        "current": 6.57,
        "voltage": 16,
        "power": 105.1,
        "force": 3.69,
        "efficiency": 35.1
    },
    "1720": {
        "rpm": 1506,
        "current": 6.8,
        "voltage": 16,
        "power": 108.8,
        "force": 3.79,
        "efficiency": 34.9
    },
    "1724": {
        "rpm": 1526,
        "current": 7.03,
        "voltage": 16,
        "power": 112.5,
        "force": 3.9,
        "efficiency": 34.6
    },
    "1728": {
        "rpm": 1546,
        "current": 7.27,
        "voltage": 16,
        "power": 116.3,
        "force": 4.0,
        "efficiency": 34.4
    },
    "1732": {
        "rpm": 1566,
        "current": 7.51,
        "voltage": 16,
        "power": 120.1,
        "force": 4.1,
        "efficiency": 34.1
    },
    "1736": {
        "rpm": 1585,
        "current": 7.75,
        "voltage": 16,
        "power": 124.0,
        "force": 4.21,
        "efficiency": 33.9
    },
    "1740": {
        "rpm": 1605,
        "current": 8.01,
        "voltage": 16,
        "power": 128.1,
        "force": 4.31,
        "efficiency": 33.7
    },
    "1744": {
        "rpm": 1625,
        "current": 8.27,
        "voltage": 16,
        "power": 132.3,
        "force": 4.42,
        "efficiency": 33.4
    },
    "1748": {
        "rpm": 1645,
        "current": 8.57,
        "voltage": 16,
        "power": 137.1,
        "force": 4.53,
        "efficiency": 33.1
    },
    "1752": {
        "rpm": 1665,
        "current": 8.87,
        "voltage": 16,
        "power": 141.9,
        "force": 4.65,
        "efficiency": 32.7
    },
    "1756": {
        "rpm": 1684,
        "current": 9.17,
        "voltage": 16,
        "power": 146.8,
        "force": 4.76,
        "efficiency": 32.4
    },
    "1760": {
        "rpm": 1705,
        "current": 9.48,
        "voltage": 16,
        "power": 151.8,
        "force": 4.87,
        "efficiency": 32.1
    },
    "1764": {
        "rpm": 1724,
        "current": 9.8,
        "voltage": 16,
        "power": 156.8,
        "force": 4.99,
        "efficiency": 31.8
    },
    "1768": {
        "rpm": 1743,
        "current": 10.12,
        "voltage": 16,
        "power": 161.8,
        "force": 5.1,
        "efficiency": 31.5
    },
    "1772": {
        "rpm": 1762,
        "current": 10.44,
        "voltage": 16,
        "power": 167.1,
        "force": 5.21,
        "efficiency": 31.2
    },
    "1776": {
        "rpm": 1781,
        "current": 10.77,
        "voltage": 16,
        "power": 172.3,
        "force": 5.33,
        "efficiency": 30.9
    },
    "1780": {
        "rpm": 1799,
        "current": 11.09,
        "voltage": 16,
        "power": 177.4,
        "force": 5.44,
        "efficiency": 30.7
    },
    "1784": {
        "rpm": 1817,
        "current": 11.43,
        "voltage": 16,
        "power": 182.8,
        "force": 5.56,
        "efficiency": 30.4
    },
    "1788": {
        "rpm": 1836,
        "current": 11.78,
        "voltage": 16,
        "power": 188.5,
        "force": 5.67,
        "efficiency": 30.1
    },
    "1792": {
        "rpm": 1855,
        "current": 12.14,
        "voltage": 16,
        "power": 194.2,
        "force": 5.79,
        "efficiency": 29.8
    },
    "1796": {
        "rpm": 1873,
        "current": 12.51,
        "voltage": 16,
        "power": 200.1,
        "force": 5.91,
        "efficiency": 29.5
    },
    "1800": {
        "rpm": 1893,
        "current": 12.89,
        "voltage": 16,
        "power": 206.3,
        "force": 6.04,
        "efficiency": 29.3
    },
    "1804": {
        "rpm": 1912,
        "current": 13.28,
        "voltage": 16,
        "power": 212.5,
        "force": 6.16,
        "efficiency": 29.0
    },
    "1808": {
        "rpm": 1930,
        "current": 13.67,
        "voltage": 16,
        "power": 218.7,
        "force": 6.29,
        "efficiency": 28.7
    },
    "1812": {
        "rpm": 1948,
        "current": 14.06,
        "voltage": 16,
        "power": 224.9,
        "force": 6.41,
        "efficiency": 28.5
    },
    "1816": {
        "rpm": 1965,
        "current": 14.43,
        "voltage": 16,
        "power": 230.9,
        "force": 6.53,
        "efficiency": 28.3
    },
    "1820": {
        "rpm": 1983,
        "current": 14.82,
        "voltage": 16,
        "power": 237.2,
        "force": 6.65,
        "efficiency": 28.0
    },
    "1824": {
        "rpm": 2000,
        "current": 15.21,
        "voltage": 16,
        "power": 243.4,
        "force": 6.77,
        "efficiency": 27.8
    },
    "1828": {
        "rpm": 2017,
        "current": 15.62,
        "voltage": 16,
        "power": 249.9,
        "force": 6.89,
        "efficiency": 27.6
    },
    "1832": {
        "rpm": 2035,
        "current": 16.05,
        "voltage": 16,
        "power": 256.8,
        "force": 7.02,
        "efficiency": 27.3
    },
    "1836": {
        "rpm": 2052,
        "current": 16.48,
        "voltage": 16,
        "power": 263.7,
        "force": 7.15,
        "efficiency": 27.1
    },
    "1840": {
        "rpm": 2069,
        "current": 16.92,
        "voltage": 16,
        "power": 270.7,
        "force": 7.28,
        "efficiency": 26.9
    },
    "1844": {
        "rpm": 2087,
        "current": 17.38,
        "voltage": 16,
        "power": 278.0,
        "force": 7.41,
        "efficiency": 26.7
    },
    "1848": {
        "rpm": 2105,
        "current": 17.84,
        "voltage": 16,
        "power": 285.5,
        "force": 7.54,
        "efficiency": 26.4
    },
    "1852": {
        "rpm": 2123,
        "current": 18.29,
        "voltage": 16,
        "power": 292.7,
        "force": 7.67,
        "efficiency": 26.2
    },
    "1856": {
        "rpm": 2139,
        "current": 18.73,
        "voltage": 16,
        "power": 299.7,
        "force": 7.79,
        "efficiency": 26.0
    },
    "1860": {
        "rpm": 2155,
        "current": 19.14,
        "voltage": 16,
        "power": 306.3,
        "force": 7.91,
        "efficiency": 25.8
    },
    "1864": {
        "rpm": 2169,
        "current": 19.55,
        "voltage": 16,
        "power": 312.8,
        "force": 8.03,
        "efficiency": 25.7
    },
    "1868": {
        "rpm": 2185,
        "current": 20.0,
        "voltage": 16,
        "power": 320.0,
        "force": 8.16,
        "efficiency": 25.5
    },
    "1872": {
        "rpm": 2201,
        "current": 20.45,
        "voltage": 16,
        "power": 327.1,
        "force": 8.28,
        "efficiency": 25.3
    },
    "1876": {
        "rpm": 2216,
        "current": 20.89,
        "voltage": 16,
        "power": 334.2,
        "force": 8.41,
        "efficiency": 25.2
    },
    "1880": {
        "rpm": 2232,
        "current": 21.34,
        "voltage": 16,
        "power": 341.4,
        "force": 8.53,
        "efficiency": 25.0
    },
    "1884": {
        "rpm": 2248,
        "current": 21.78,
        "voltage": 16,
        "power": 348.5,
        "force": 8.66,
        "efficiency": 24.8
    },
    "1888": {
        "rpm": 2264,
        "current": 22.23,
        "voltage": 16,
        "power": 355.6,
        "force": 8.78,
        "efficiency": 24.7
    },
    "1892": {
        "rpm": 2279,
        "current": 22.67,
        "voltage": 16,
        "power": 362.7,
        "force": 8.91,
        "efficiency": 24.6
    },
    "1896": {
        "rpm": 2295,
        "current": 23.12,
        "voltage": 16,
        "power": 369.9,
        "force": 9.03,
        "efficiency": 24.4
    },
    "1900": {
        "rpm": 2311,
        "current": 23.56,
        "voltage": 16,
        "power": 377.0,
        "force": 9.16,
        "efficiency": 24.3
    }
};

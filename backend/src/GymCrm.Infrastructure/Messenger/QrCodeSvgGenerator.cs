using System.Globalization;
using System.Text;

namespace GymCrm.Infrastructure.Messenger;

internal static class QrCodeSvgGenerator
{
    private const int Version = 7;
    private const int Size = 17 + 4 * Version;
    private const int DataCodewords = 124;
    private const int DataBlocks = 4;
    private const int DataCodewordsPerBlock = 31;
    private const int ErrorCorrectionCodewordsPerBlock = 18;
    private const int FormatBitsMedium = 0;
    private const int MaskPattern = 0;

    private static readonly int[] AlignmentPatternCenters = [6, 22, 38];

    public static string GenerateSvg(string payload)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(payload);

        var payloadBytes = Encoding.UTF8.GetBytes(payload);
        if (payloadBytes.Length > 121)
        {
            throw new InvalidOperationException("QR payload is too long for the built-in generator.");
        }

        var codewords = BuildCodewords(payloadBytes);
        var modules = new bool[Size, Size];
        var reserved = new bool[Size, Size];

        DrawFunctionPatterns(modules, reserved);
        DrawCodewords(modules, reserved, codewords);
        DrawFormatBits(modules, reserved);
        DrawVersionBits(modules, reserved);

        return ToSvg(modules);
    }

    private static IReadOnlyList<int> BuildCodewords(byte[] payloadBytes)
    {
        var bits = new List<bool>();
        AppendBits(bits, 0b0100, 4);
        AppendBits(bits, payloadBytes.Length, 8);

        foreach (var payloadByte in payloadBytes)
        {
            AppendBits(bits, payloadByte, 8);
        }

        var dataCapacityBits = DataCodewords * 8;
        var terminatorLength = Math.Min(4, dataCapacityBits - bits.Count);
        AppendBits(bits, 0, terminatorLength);

        while (bits.Count % 8 != 0)
        {
            bits.Add(false);
        }

        var data = new List<int>();
        for (var i = 0; i < bits.Count; i += 8)
        {
            var value = 0;
            for (var j = 0; j < 8; j++)
            {
                value = (value << 1) | (bits[i + j] ? 1 : 0);
            }

            data.Add(value);
        }

        for (var padByte = 0xEC; data.Count < DataCodewords; padByte ^= 0xEC ^ 0x11)
        {
            data.Add(padByte);
        }

        var blocks = new List<IReadOnlyList<int>>();
        var errorCorrectionBlocks = new List<IReadOnlyList<int>>();
        for (var blockIndex = 0; blockIndex < DataBlocks; blockIndex++)
        {
            var block = data
                .Skip(blockIndex * DataCodewordsPerBlock)
                .Take(DataCodewordsPerBlock)
                .ToArray();
            blocks.Add(block);
            errorCorrectionBlocks.Add(ComputeErrorCorrection(block, ErrorCorrectionCodewordsPerBlock));
        }

        var result = new List<int>();
        for (var i = 0; i < DataCodewordsPerBlock; i++)
        {
            foreach (var block in blocks)
            {
                result.Add(block[i]);
            }
        }

        for (var i = 0; i < ErrorCorrectionCodewordsPerBlock; i++)
        {
            foreach (var block in errorCorrectionBlocks)
            {
                result.Add(block[i]);
            }
        }

        return result;
    }

    private static int[] ComputeErrorCorrection(IReadOnlyList<int> data, int degree)
    {
        var generator = BuildGeneratorPolynomial(degree);
        var result = new int[degree];

        foreach (var value in data)
        {
            var factor = value ^ result[0];
            Array.Copy(result, 1, result, 0, degree - 1);
            result[degree - 1] = 0;

            for (var i = 0; i < degree; i++)
            {
                result[i] ^= GaloisMultiply(generator[i + 1], factor);
            }
        }

        return result;
    }

    private static int[] BuildGeneratorPolynomial(int degree)
    {
        var result = new[] { 1 };
        for (var i = 0; i < degree; i++)
        {
            result = MultiplyPolynomials(result, [1, GaloisPow(i)]);
        }

        return result;
    }

    private static int[] MultiplyPolynomials(IReadOnlyList<int> left, IReadOnlyList<int> right)
    {
        var result = new int[left.Count + right.Count - 1];
        for (var i = 0; i < left.Count; i++)
        {
            for (var j = 0; j < right.Count; j++)
            {
                result[i + j] ^= GaloisMultiply(left[i], right[j]);
            }
        }

        return result;
    }

    private static int GaloisPow(int exponent)
    {
        var value = 1;
        for (var i = 0; i < exponent; i++)
        {
            value <<= 1;
            if (value >= 0x100)
            {
                value ^= 0x11D;
            }
        }

        return value;
    }

    private static int GaloisMultiply(int left, int right)
    {
        var result = 0;
        for (var i = 0; i < 8; i++)
        {
            if ((right & 1) != 0)
            {
                result ^= left;
            }

            right >>= 1;
            left <<= 1;
            if ((left & 0x100) != 0)
            {
                left ^= 0x11D;
            }
        }

        return result;
    }

    private static void DrawFunctionPatterns(bool[,] modules, bool[,] reserved)
    {
        DrawFinderPattern(modules, reserved, 0, 0);
        DrawFinderPattern(modules, reserved, Size - 7, 0);
        DrawFinderPattern(modules, reserved, 0, Size - 7);

        for (var i = 8; i < Size - 8; i++)
        {
            SetFunctionModule(modules, reserved, i, 6, i % 2 == 0);
            SetFunctionModule(modules, reserved, 6, i, i % 2 == 0);
        }

        foreach (var centerY in AlignmentPatternCenters)
        {
            foreach (var centerX in AlignmentPatternCenters)
            {
                if ((centerX == 6 && centerY == 6) ||
                    (centerX == 6 && centerY == Size - 7) ||
                    (centerX == Size - 7 && centerY == 6))
                {
                    continue;
                }

                DrawAlignmentPattern(modules, reserved, centerX, centerY);
            }
        }

        ReserveFormatAreas(reserved);
        ReserveVersionAreas(reserved);
        SetFunctionModule(modules, reserved, 8, Size - 8, true);
    }

    private static void DrawFinderPattern(bool[,] modules, bool[,] reserved, int x, int y)
    {
        for (var dy = -1; dy <= 7; dy++)
        {
            for (var dx = -1; dx <= 7; dx++)
            {
                var moduleX = x + dx;
                var moduleY = y + dy;
                if (moduleX < 0 || moduleX >= Size || moduleY < 0 || moduleY >= Size)
                {
                    continue;
                }

                var inPattern = dx is >= 0 and <= 6 && dy is >= 0 and <= 6;
                var dark = inPattern &&
                    (dx is 0 or 6 || dy is 0 or 6 || (dx is >= 2 and <= 4 && dy is >= 2 and <= 4));

                SetFunctionModule(modules, reserved, moduleX, moduleY, dark);
            }
        }
    }

    private static void DrawAlignmentPattern(bool[,] modules, bool[,] reserved, int centerX, int centerY)
    {
        for (var dy = -2; dy <= 2; dy++)
        {
            for (var dx = -2; dx <= 2; dx++)
            {
                var distance = Math.Max(Math.Abs(dx), Math.Abs(dy));
                SetFunctionModule(modules, reserved, centerX + dx, centerY + dy, distance is 0 or 2);
            }
        }
    }

    private static void ReserveFormatAreas(bool[,] reserved)
    {
        for (var i = 0; i <= 8; i++)
        {
            if (i != 6)
            {
                reserved[8, i] = true;
                reserved[i, 8] = true;
            }
        }

        for (var i = 0; i < 8; i++)
        {
            reserved[8, Size - 1 - i] = true;
            reserved[Size - 1 - i, 8] = true;
        }
    }

    private static void ReserveVersionAreas(bool[,] reserved)
    {
        for (var i = 0; i < 6; i++)
        {
            for (var j = 0; j < 3; j++)
            {
                reserved[i, Size - 11 + j] = true;
                reserved[Size - 11 + j, i] = true;
            }
        }
    }

    private static void DrawCodewords(bool[,] modules, bool[,] reserved, IReadOnlyList<int> codewords)
    {
        var bits = new List<bool>(codewords.Count * 8);
        foreach (var codeword in codewords)
        {
            AppendBits(bits, codeword, 8);
        }

        var bitIndex = 0;
        var upward = true;
        for (var right = Size - 1; right >= 1; right -= 2)
        {
            if (right == 6)
            {
                right--;
            }

            for (var vertical = 0; vertical < Size; vertical++)
            {
                var y = upward ? Size - 1 - vertical : vertical;
                for (var column = 0; column < 2; column++)
                {
                    var x = right - column;
                    if (reserved[y, x])
                    {
                        continue;
                    }

                    var dark = bitIndex < bits.Count && bits[bitIndex];
                    bitIndex++;
                    if ((x + y) % 2 == 0)
                    {
                        dark = !dark;
                    }

                    modules[y, x] = dark;
                }
            }

            upward = !upward;
        }
    }

    private static void DrawFormatBits(bool[,] modules, bool[,] reserved)
    {
        var bits = GetFormatBits();

        for (var i = 0; i <= 5; i++)
        {
            SetFunctionModule(modules, reserved, 8, i, GetBit(bits, i));
        }

        SetFunctionModule(modules, reserved, 8, 7, GetBit(bits, 6));
        SetFunctionModule(modules, reserved, 8, 8, GetBit(bits, 7));
        SetFunctionModule(modules, reserved, 7, 8, GetBit(bits, 8));

        for (var i = 9; i < 15; i++)
        {
            SetFunctionModule(modules, reserved, 14 - i, 8, GetBit(bits, i));
        }

        for (var i = 0; i < 8; i++)
        {
            SetFunctionModule(modules, reserved, Size - 1 - i, 8, GetBit(bits, i));
        }

        for (var i = 8; i < 15; i++)
        {
            SetFunctionModule(modules, reserved, 8, Size - 15 + i, GetBit(bits, i));
        }

        SetFunctionModule(modules, reserved, 8, Size - 8, true);
    }

    private static int GetFormatBits()
    {
        var data = (FormatBitsMedium << 3) | MaskPattern;
        var remainder = data;
        for (var i = 0; i < 10; i++)
        {
            remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
        }

        return ((data << 10) | remainder) ^ 0x5412;
    }

    private static void DrawVersionBits(bool[,] modules, bool[,] reserved)
    {
        var bits = GetVersionBits();
        for (var i = 0; i < 18; i++)
        {
            var bit = GetBit(bits, i);
            var x = Size - 11 + i % 3;
            var y = i / 3;
            SetFunctionModule(modules, reserved, x, y, bit);
            SetFunctionModule(modules, reserved, y, x, bit);
        }
    }

    private static int GetVersionBits()
    {
        var remainder = Version;
        for (var i = 0; i < 12; i++)
        {
            remainder = (remainder << 1) ^ ((remainder >> 11) * 0x1F25);
        }

        return (Version << 12) | remainder;
    }

    private static void SetFunctionModule(bool[,] modules, bool[,] reserved, int x, int y, bool dark)
    {
        modules[y, x] = dark;
        reserved[y, x] = true;
    }

    private static bool GetBit(int value, int index)
    {
        return ((value >> index) & 1) != 0;
    }

    private static void AppendBits(ICollection<bool> bits, int value, int length)
    {
        for (var i = length - 1; i >= 0; i--)
        {
            bits.Add(((value >> i) & 1) != 0);
        }
    }

    private static string ToSvg(bool[,] modules)
    {
        const int quietZone = 4;
        var viewBoxSize = Size + quietZone * 2;
        var builder = new StringBuilder();
        builder.Append(CultureInfo.InvariantCulture, $"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {viewBoxSize} {viewBoxSize}\" shape-rendering=\"crispEdges\">");
        builder.Append(CultureInfo.InvariantCulture, $"<rect width=\"{viewBoxSize}\" height=\"{viewBoxSize}\" fill=\"#fff\"/>");

        for (var y = 0; y < Size; y++)
        {
            for (var x = 0; x < Size; x++)
            {
                if (modules[y, x])
                {
                    builder.Append(CultureInfo.InvariantCulture, $"<rect x=\"{x + quietZone}\" y=\"{y + quietZone}\" width=\"1\" height=\"1\" fill=\"#111\"/>");
                }
            }
        }

        builder.Append("</svg>");
        return builder.ToString();
    }
}

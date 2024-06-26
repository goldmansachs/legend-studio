// Generated from /Users/blacksteed232/Developer/legend/studio/packages/legend-application-repl/grammar/datacube_filter__lexer.g4 by ANTLR 4.13.1
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
	ATN,
	ATNDeserializer,
	CharStream,
	DecisionState, DFA,
	Lexer,
	LexerATNSimulator,
	RuleContext,
	PredictionContextCache,
	Token
} from "antlr4";
export default class datacube_filter__lexer extends Lexer {
	public static readonly OPERATOR = 1;
	public static readonly GROUP_OPERATOR_AND = 2;
	public static readonly GROUP_OPERATOR_OR = 3;
	public static readonly GROUP_OPEN = 4;
	public static readonly GROUP_CLOSE = 5;
	public static readonly NUMBER = 6;
	public static readonly STRING = 7;
	public static readonly COLUMN = 8;
	public static readonly IDENTIFIER = 9;
	public static readonly WHITESPACE = 10;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, null, 
                                                            "'&&'", "'||'", 
                                                            "'('", "')'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, "OPERATOR", 
                                                             "GROUP_OPERATOR_AND", 
                                                             "GROUP_OPERATOR_OR", 
                                                             "GROUP_OPEN", 
                                                             "GROUP_CLOSE", 
                                                             "NUMBER", "STRING", 
                                                             "COLUMN", "IDENTIFIER", 
                                                             "WHITESPACE" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"Whitespace", "Identifier", "Letter", "Digit", "HexDigit", "UnicodeEsc", 
		"Esc", "StringEscSeq", "String", "Number", "ColumnEscSeq", "Column", "OPERATOR", 
		"GROUP_OPERATOR_AND", "GROUP_OPERATOR_OR", "GROUP_OPEN", "GROUP_CLOSE", 
		"NUMBER", "STRING", "COLUMN", "IDENTIFIER", "WHITESPACE",
	];


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, datacube_filter__lexer._ATN, datacube_filter__lexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "datacube_filter__lexer.g4"; }

	public get literalNames(): (string | null)[] { return datacube_filter__lexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return datacube_filter__lexer.symbolicNames; }
	public get ruleNames(): string[] { return datacube_filter__lexer.ruleNames; }

	public get serializedATN(): number[] { return datacube_filter__lexer._serializedATN; }

	public get channelNames(): string[] { return datacube_filter__lexer.channelNames; }

	public get modeNames(): string[] { return datacube_filter__lexer.modeNames; }

	public static readonly _serializedATN: number[] = [4,0,10,186,6,-1,2,0,
	7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,
	7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,
	16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,1,0,4,0,47,8,0,11,
	0,12,0,48,1,1,1,1,1,1,1,1,5,1,55,8,1,10,1,12,1,58,9,1,1,1,1,1,3,1,62,8,
	1,1,2,1,2,1,3,1,3,1,4,1,4,1,5,1,5,1,5,1,5,1,5,3,5,75,8,5,3,5,77,8,5,3,5,
	79,8,5,3,5,81,8,5,1,6,1,6,1,7,1,7,1,7,1,7,1,7,3,7,90,8,7,1,8,1,8,1,8,5,
	8,95,8,8,10,8,12,8,98,9,8,1,8,1,8,1,9,5,9,103,8,9,10,9,12,9,106,9,9,1,9,
	1,9,4,9,110,8,9,11,9,12,9,111,1,9,4,9,115,8,9,11,9,12,9,116,3,9,119,8,9,
	1,9,1,9,3,9,123,8,9,1,9,4,9,126,8,9,11,9,12,9,127,3,9,130,8,9,1,10,1,10,
	1,10,1,10,1,10,3,10,137,8,10,1,11,1,11,1,11,5,11,142,8,11,10,11,12,11,145,
	9,11,1,11,1,11,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,1,12,3,
	12,160,8,12,1,13,1,13,1,13,1,14,1,14,1,14,1,15,1,15,1,16,1,16,1,17,1,17,
	1,18,1,18,1,19,1,19,1,20,1,20,1,21,4,21,181,8,21,11,21,12,21,182,1,21,1,
	21,0,0,22,1,0,3,0,5,0,7,0,9,0,11,0,13,0,15,0,17,0,19,0,21,0,23,0,25,1,27,
	2,29,3,31,4,33,5,35,6,37,7,39,8,41,9,43,10,1,0,11,3,0,9,10,13,13,32,32,
	2,0,65,90,97,122,1,0,48,57,3,0,48,57,65,70,97,102,8,0,34,34,39,39,92,92,
	98,98,102,102,110,110,114,114,116,116,4,0,10,10,13,13,34,34,92,92,2,0,69,
	69,101,101,2,0,43,43,45,45,6,0,91,93,98,98,102,102,110,110,114,114,116,
	116,3,0,10,10,13,13,91,93,2,0,60,60,62,62,205,0,25,1,0,0,0,0,27,1,0,0,0,
	0,29,1,0,0,0,0,31,1,0,0,0,0,33,1,0,0,0,0,35,1,0,0,0,0,37,1,0,0,0,0,39,1,
	0,0,0,0,41,1,0,0,0,0,43,1,0,0,0,1,46,1,0,0,0,3,50,1,0,0,0,5,63,1,0,0,0,
	7,65,1,0,0,0,9,67,1,0,0,0,11,69,1,0,0,0,13,82,1,0,0,0,15,84,1,0,0,0,17,
	91,1,0,0,0,19,118,1,0,0,0,21,131,1,0,0,0,23,138,1,0,0,0,25,159,1,0,0,0,
	27,161,1,0,0,0,29,164,1,0,0,0,31,167,1,0,0,0,33,169,1,0,0,0,35,171,1,0,
	0,0,37,173,1,0,0,0,39,175,1,0,0,0,41,177,1,0,0,0,43,180,1,0,0,0,45,47,7,
	0,0,0,46,45,1,0,0,0,47,48,1,0,0,0,48,46,1,0,0,0,48,49,1,0,0,0,49,2,1,0,
	0,0,50,56,3,5,2,0,51,55,3,5,2,0,52,55,3,7,3,0,53,55,5,32,0,0,54,51,1,0,
	0,0,54,52,1,0,0,0,54,53,1,0,0,0,55,58,1,0,0,0,56,54,1,0,0,0,56,57,1,0,0,
	0,57,61,1,0,0,0,58,56,1,0,0,0,59,62,3,5,2,0,60,62,3,7,3,0,61,59,1,0,0,0,
	61,60,1,0,0,0,62,4,1,0,0,0,63,64,7,1,0,0,64,6,1,0,0,0,65,66,7,2,0,0,66,
	8,1,0,0,0,67,68,7,3,0,0,68,10,1,0,0,0,69,80,5,117,0,0,70,78,3,9,4,0,71,
	76,3,9,4,0,72,74,3,9,4,0,73,75,3,9,4,0,74,73,1,0,0,0,74,75,1,0,0,0,75,77,
	1,0,0,0,76,72,1,0,0,0,76,77,1,0,0,0,77,79,1,0,0,0,78,71,1,0,0,0,78,79,1,
	0,0,0,79,81,1,0,0,0,80,70,1,0,0,0,80,81,1,0,0,0,81,12,1,0,0,0,82,83,5,92,
	0,0,83,14,1,0,0,0,84,89,3,13,6,0,85,90,7,4,0,0,86,90,3,11,5,0,87,90,9,0,
	0,0,88,90,5,0,0,1,89,85,1,0,0,0,89,86,1,0,0,0,89,87,1,0,0,0,89,88,1,0,0,
	0,90,16,1,0,0,0,91,96,5,34,0,0,92,95,3,15,7,0,93,95,8,5,0,0,94,92,1,0,0,
	0,94,93,1,0,0,0,95,98,1,0,0,0,96,94,1,0,0,0,96,97,1,0,0,0,97,99,1,0,0,0,
	98,96,1,0,0,0,99,100,5,34,0,0,100,18,1,0,0,0,101,103,3,7,3,0,102,101,1,
	0,0,0,103,106,1,0,0,0,104,102,1,0,0,0,104,105,1,0,0,0,105,107,1,0,0,0,106,
	104,1,0,0,0,107,109,5,46,0,0,108,110,3,7,3,0,109,108,1,0,0,0,110,111,1,
	0,0,0,111,109,1,0,0,0,111,112,1,0,0,0,112,119,1,0,0,0,113,115,3,7,3,0,114,
	113,1,0,0,0,115,116,1,0,0,0,116,114,1,0,0,0,116,117,1,0,0,0,117,119,1,0,
	0,0,118,104,1,0,0,0,118,114,1,0,0,0,119,129,1,0,0,0,120,122,7,6,0,0,121,
	123,7,7,0,0,122,121,1,0,0,0,122,123,1,0,0,0,123,125,1,0,0,0,124,126,3,7,
	3,0,125,124,1,0,0,0,126,127,1,0,0,0,127,125,1,0,0,0,127,128,1,0,0,0,128,
	130,1,0,0,0,129,120,1,0,0,0,129,130,1,0,0,0,130,20,1,0,0,0,131,136,3,13,
	6,0,132,137,7,8,0,0,133,137,3,11,5,0,134,137,9,0,0,0,135,137,5,0,0,1,136,
	132,1,0,0,0,136,133,1,0,0,0,136,134,1,0,0,0,136,135,1,0,0,0,137,22,1,0,
	0,0,138,143,5,91,0,0,139,142,3,15,7,0,140,142,8,9,0,0,141,139,1,0,0,0,141,
	140,1,0,0,0,142,145,1,0,0,0,143,141,1,0,0,0,143,144,1,0,0,0,144,146,1,0,
	0,0,145,143,1,0,0,0,146,147,5,93,0,0,147,24,1,0,0,0,148,149,5,61,0,0,149,
	160,5,61,0,0,150,151,5,33,0,0,151,160,5,61,0,0,152,153,5,60,0,0,153,160,
	5,62,0,0,154,160,7,10,0,0,155,156,5,62,0,0,156,160,5,61,0,0,157,158,5,60,
	0,0,158,160,5,61,0,0,159,148,1,0,0,0,159,150,1,0,0,0,159,152,1,0,0,0,159,
	154,1,0,0,0,159,155,1,0,0,0,159,157,1,0,0,0,160,26,1,0,0,0,161,162,5,38,
	0,0,162,163,5,38,0,0,163,28,1,0,0,0,164,165,5,124,0,0,165,166,5,124,0,0,
	166,30,1,0,0,0,167,168,5,40,0,0,168,32,1,0,0,0,169,170,5,41,0,0,170,34,
	1,0,0,0,171,172,3,19,9,0,172,36,1,0,0,0,173,174,3,17,8,0,174,38,1,0,0,0,
	175,176,3,23,11,0,176,40,1,0,0,0,177,178,3,3,1,0,178,42,1,0,0,0,179,181,
	7,0,0,0,180,179,1,0,0,0,181,182,1,0,0,0,182,180,1,0,0,0,182,183,1,0,0,0,
	183,184,1,0,0,0,184,185,6,21,0,0,185,44,1,0,0,0,24,0,48,54,56,61,74,76,
	78,80,89,94,96,104,111,116,118,122,127,129,136,141,143,159,182,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!datacube_filter__lexer.__ATN) {
			datacube_filter__lexer.__ATN = new ATNDeserializer().deserialize(datacube_filter__lexer._serializedATN);
		}

		return datacube_filter__lexer.__ATN;
	}


	static DecisionsToDFA = datacube_filter__lexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}
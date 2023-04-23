export default class Constants {
    public static readonly MIN_PLAYERS                          = process.env.MIN_PLAYERS ?? 4;
    public static readonly MAX_PLAYERS                          = process.env.MAX_PLAYERS ?? 10;
    public static readonly VOTE_POINTS                          = process.env.VOTE_POINTS ?? 1;
    public static readonly GUESS_POINTS                         = process.env.GUESS_POINTS ?? 3;
    public static readonly EVERYONE_GUESSED_POINTS              = process.env.EVERYONE_GUESSED_POINTS ?? 2;
    public static readonly NOT_EVERYONE_GUESSED_LEADER_POINTS   = process.env.NOT_EVERYONE_GUESSED_LEADER_POINTS ?? 3;
    public static readonly EVERYONE_GUESSED_LEADER_POINTS       = process.env.EVERYONE_GUESSED_LEADER_POINTS ?? 0;
    public static readonly MAX_BUTTONS_IN_ROW                   = process.env.MAX_BUTTONS_IN_ROW ?? 5;
    public static readonly NEXT_ROUND_WAIT                      = process.env.NEXT_ROUND_WAIT ?? 3000;
}
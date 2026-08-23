import jwt from 'jsonwebtoken';


const authUser = async (req, res, next) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const token = bearerToken || req.cookies.userToken;
    if(!token)
        return res.json({success: false, message: "Not Authorized"});
    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if(tokenDecode.id){
            req.userId = tokenDecode.id;
        }else{
            return res.json({success: false, message: "Not Authorized"});
        }
        next();
    } catch (error) {
        res.json({success: false, message: error.message});
    }
}

export default authUser;
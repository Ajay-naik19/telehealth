function injectStaticPaths(req, res, next) {
    res.locals.staticPath = (filePath) => {
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return `/${cleanPath}`;
    };

    if (req.user) {
        res.locals.user = req.user;
    }

    next();
}

module.exports = injectStaticPaths;
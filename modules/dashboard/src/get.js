import axios from "axios";

const apiUrl = process.env.REACT_APP_API_URL || `http://localhost:9999`

const get = async (url) => {
    console.log(`Getting ${url}...`)
    const res = await axios.get(`${apiUrl}/${url}`)
    if (res.data) {
      return res.data
    } else {
      return null
    }
}

export default get
